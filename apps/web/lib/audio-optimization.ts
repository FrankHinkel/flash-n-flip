"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

import { createLocalAudioOptimizationStorage } from "@flashcards/direct-connect-webstack/audio-optimization-storage";
import {
  directConnectionIsConnected,
  directPeerDeviceId,
} from "@flashcards/direct-connect-webstack/connection-state";
import { getOrCreateDeviceIdentity } from "@flashcards/direct-connect-webstack/identity";
import {
  audioJobBelongsToDevice,
  audioOptimizationJobSchema,
  isAudioDerivativeReferenceFileName,
  speechAudioPipeline,
  type AudioOptimizationJob,
  type AudioQualityMeasurement,
} from "@flashcards/domain/audio-optimization";

import {
  browserAudioOptimizationAvailable,
  optimizeAudioInBrowser,
  type LocalAudioEngineResult,
} from "./browser-audio-optimizer";
import {
  getLocalProductOriginalMedia,
  installOptimizedLocalAudio,
  localProductRepository,
} from "./local-product-repository";

const legacyStorageKey = "flash-n-flip.audio-optimization.v1";
const pausedStorageKey = "flash-n-flip.audio-optimization.paused.v2";
export const audioOptimizationChangedEvent =
  "flash-n-flip:audio-optimization-changed";

type NativeAudioResult = Omit<LocalAudioEngineResult, "bytes">;

type AudioPlugin = {
  begin(input: { jobId: string; fileExtension: string }): Promise<void>;
  appendInput(input: {
    jobId: string;
    dataBase64: string;
  }): Promise<{ receivedBytes: number; totalBytes: number }>;
  optimizeFile(input: { jobId: string }): Promise<NativeAudioResult>;
  readOutput(input: {
    jobId: string;
    offset: number;
    length: number;
  }): Promise<{ dataBase64: string; eof: boolean }>;
  cleanup(input: { jobId: string }): Promise<void>;
};

const nativeAudio = registerPlugin<AudioPlugin>("FlashNFlipAudio");
const storage = createLocalAudioOptimizationStorage();
let jobs: AudioOptimizationJob[] = [];
let hydration: Promise<void> | null = null;
let activeRun: Promise<void> | null = null;
let automaticRetryTimer: ReturnType<typeof setTimeout> | null = null;
const automaticRetryDelayMs = 60_000;

const notify = () => {
  window.dispatchEvent(new CustomEvent(audioOptimizationChangedEvent));
};

const isPaused = (): boolean => localStorage.getItem(pausedStorageKey) === "1";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const extensionFor = (mimeType: string): string => {
  if (mimeType === "audio/mpeg") return "mp3";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return "wav";
  if (mimeType === "audio/flac") return "flac";
  if (mimeType === "audio/ogg") return "ogg";
  return "m4a";
};

export type AudioOptimizationIssueKind =
  | "DEVICE_PROTECTION"
  | "EMPTY"
  | "SIZE_LIMIT"
  | "DURATION_LIMIT"
  | "FORMAT_OR_DECODE"
  | "TOO_SHORT_OR_SILENT"
  | "ANALYSIS"
  | "ENCODING"
  | "STORAGE"
  | "ENGINE_UNAVAILABLE"
  | "UNKNOWN";

export type AudioOptimizationSuspensionReason = "BATTERY" | "THERMAL";

export const audioOptimizationSuspensionReason = (
  message: string | undefined,
): AudioOptimizationSuspensionReason | undefined => {
  const normalized = (message ?? "").toLowerCase();
  if (
    normalized.includes("deferred_thermal") ||
    normalized.includes("temperature") ||
    normalized.includes("thermal") ||
    normalized.includes("cool")
  ) {
    return "THERMAL";
  }
  if (
    normalized.includes("deferred_battery") ||
    normalized.includes("battery") ||
    normalized.includes("low power") ||
    normalized.includes("charging")
  ) {
    return "BATTERY";
  }
  return undefined;
};

type AudioOptimizationIssueDisposition = "DEFER" | "UNSUPPORTED" | "RETRY";

export const classifyAudioOptimizationIssue = (
  message: string | undefined,
): {
  kind: AudioOptimizationIssueKind;
  disposition: AudioOptimizationIssueDisposition;
} => {
  const normalized = (message ?? "").toLowerCase();
  if (
    normalized.includes("paused to protect battery and temperature") ||
    normalized.includes("low power") ||
    normalized.includes("thermal") ||
    normalized.startsWith("deferred:") ||
    normalized.startsWith("deferred_battery:") ||
    normalized.startsWith("deferred_thermal:")
  ) {
    return { kind: "DEVICE_PROTECTION", disposition: "DEFER" };
  }
  if (normalized.includes("größer als 16") || normalized.includes("16 mib")) {
    return { kind: "SIZE_LIMIT", disposition: "UNSUPPORTED" };
  }
  if (
    normalized.includes("länger als 30") ||
    normalized.includes("30 minutes")
  ) {
    return { kind: "DURATION_LIMIT", disposition: "UNSUPPORTED" };
  }
  if (normalized.includes("empty") || normalized.includes("leer")) {
    return { kind: "EMPTY", disposition: "UNSUPPORTED" };
  }
  if (
    normalized.includes("lieferte kein ergebnis") ||
    normalized.includes("too short or silent")
  ) {
    return { kind: "TOO_SHORT_OR_SILENT", disposition: "UNSUPPORTED" };
  }
  if (
    normalized.includes("audio track is missing") ||
    normalized.includes("no decodable audio track") ||
    normalized.includes("audio konnte nicht geprüft") ||
    /flashnflipaudio.*(?:31|32|33|34|42)/.test(normalized)
  ) {
    return { kind: "FORMAT_OR_DECODE", disposition: "UNSUPPORTED" };
  }
  if (
    normalized.includes("lautheitsanalyse") ||
    normalized.includes("loudness") ||
    normalized.includes("audiodauer") ||
    normalized.includes("abtastrate") ||
    normalized.includes("spitzenpegel")
  ) {
    return { kind: "ANALYSIS", disposition: "RETRY" };
  }
  if (
    normalized.includes("audiokodierung") ||
    normalized.includes("audio encoding") ||
    normalized.includes("audioergebnis") ||
    normalized.includes("optimized audio could not be read") ||
    normalized.includes("pcm buffer") ||
    /flashnflipaudio.*(?:30|43|44|45|46)/.test(normalized)
  ) {
    return { kind: "ENCODING", disposition: "RETRY" };
  }
  if (
    normalized.includes("originalaudio fehlt") ||
    normalized.includes("original-audioreferenz") ||
    normalized.includes("input chunk") ||
    normalized.includes("database") ||
    normalized.includes("transaction") ||
    normalized.includes("sqlite")
  ) {
    return { kind: "STORAGE", disposition: "RETRY" };
  }
  if (
    normalized.includes("worker ist hier nicht verfügbar") ||
    normalized.includes("not implemented") ||
    normalized.includes("webassembly") ||
    normalized.includes("ffmpeg")
  ) {
    return { kind: "ENGINE_UNAVAILABLE", disposition: "RETRY" };
  }
  return { kind: "UNKNOWN", disposition: "RETRY" };
};

const pruneMissingAudioJobs = async (): Promise<number> => {
  const sourceMediaIds = new Set(
    (await (await localProductRepository()).listMedia())
      .filter(
        (reference) =>
          reference.payload.mimeType.startsWith("audio/") &&
          !isAudioDerivativeReferenceFileName(reference.payload.fileName),
      )
      .map((reference) => reference.id),
  );
  const removedMediaIds = jobs
    .filter((job) => !sourceMediaIds.has(job.mediaId))
    .map((job) => job.mediaId);
  if (!removedMediaIds.length) return 0;
  await Promise.all(removedMediaIds.map((mediaId) => storage.delete(mediaId)));
  const removed = new Set(removedMediaIds);
  jobs = jobs.filter((job) => !removed.has(job.mediaId));
  notify();
  return removedMediaIds.length;
};

const ensureHydrated = (): Promise<void> => {
  hydration ??= (async () => {
    jobs = await storage.list();
    const durableIds = new Set(jobs.map((job) => job.mediaId));
    try {
      const legacy = JSON.parse(
        localStorage.getItem(legacyStorageKey) ?? "[]",
      ) as unknown;
      if (Array.isArray(legacy)) {
        for (const candidate of legacy) {
          if (
            !candidate ||
            typeof candidate !== "object" ||
            !("mediaId" in candidate) ||
            typeof candidate.mediaId !== "string" ||
            durableIds.has(candidate.mediaId)
          ) {
            continue;
          }
          const migrated = audioOptimizationJobSchema.parse({
            mediaId: candidate.mediaId,
            status: "PENDING",
            checkpoint: "MIGRATED",
            attempts: 0,
            pipelineVersion: 2,
            originalBytes:
              "originalBytes" in candidate &&
              typeof candidate.originalBytes === "number"
                ? candidate.originalBytes
                : 0,
            optimizedBytes: 0,
            potentialSavedBytes: 0,
            updatedAt: new Date().toISOString(),
          });
          await storage.put(migrated);
          jobs.push(migrated);
        }
      }
      localStorage.removeItem(legacyStorageKey);
    } catch {
      // A malformed obsolete localStorage queue must not block the durable one.
    }
    for (const job of jobs) {
      const issue = classifyAudioOptimizationIssue(job.error);
      if (
        (job.status === "FAILED_RETRYABLE" || job.status === "FAILED_FINAL") &&
        issue.disposition !== "RETRY"
      ) {
        const reset = audioOptimizationJobSchema.parse({
          ...job,
          status: issue.disposition === "DEFER" ? "PENDING" : "UNSUPPORTED",
          checkpoint:
            issue.disposition === "DEFER"
              ? "DEFERRED_DEVICE_PROTECTION"
              : "UNSUPPORTED_INPUT",
          attempts: issue.disposition === "DEFER" ? 0 : job.attempts,
          updatedAt: new Date().toISOString(),
        });
        await storage.put(reset);
        Object.assign(job, reset);
        continue;
      }
      if (
        job.status === "ANALYZING" ||
        job.status === "PROCESSING" ||
        job.status === "ENCODING" ||
        job.status === "VERIFYING"
      ) {
        const reset = {
          ...job,
          status: "PENDING" as const,
          checkpoint: "RESTARTED",
          updatedAt: new Date().toISOString(),
        };
        await storage.put(reset);
        Object.assign(job, reset);
      }
    }
    await pruneMissingAudioJobs();
    notify();
  })();
  return hydration;
};

const patchJob = async (
  mediaId: string,
  patch: Partial<AudioOptimizationJob>,
): Promise<void> => {
  const index = jobs.findIndex((job) => job.mediaId === mediaId);
  if (index < 0) return;
  const next = audioOptimizationJobSchema.parse({
    ...jobs[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await storage.put(next);
  jobs[index] = next;
  notify();
};

export const audioOptimizationJobs = (): readonly AudioOptimizationJob[] => {
  void ensureHydrated();
  return jobs;
};

export type AudioOptimizationWorkerKind = "APPLE_NATIVE" | "BROWSER" | "OTHER";

const workerKind = (
  job: Pick<AudioOptimizationJob, "engine" | "workerLabel">,
): AudioOptimizationWorkerKind => {
  const normalizedEngine = job.engine
    ?.toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "");
  if (normalizedEngine?.startsWith("avfoundation")) return "APPLE_NATIVE";
  if (normalizedEngine?.startsWith("ffmpegwasm")) return "BROWSER";
  if (job.workerLabel === "iPhone/iPad") return "APPLE_NATIVE";
  if (job.workerLabel === "Browser/PC") return "BROWSER";
  return "OTHER";
};

const workerLabelForEngine = (engine: string): string => {
  const kind = workerKind({ engine, workerLabel: undefined });
  if (kind === "APPLE_NATIVE") return "iPhone/iPad";
  if (kind === "BROWSER") return "Browser/PC";
  return "Unbekannte Engine";
};

const contributionCounts = (
  matchingJobs: readonly AudioOptimizationJob[],
): Array<[AudioOptimizationWorkerKind, number]> =>
  Object.entries(
    matchingJobs.reduce<Record<AudioOptimizationWorkerKind, number>>(
      (result, job) => {
        result[workerKind(job)] += 1;
        return result;
      },
      { APPLE_NATIVE: 0, BROWSER: 0, OTHER: 0 },
    ),
  ).filter(
    (entry): entry is [AudioOptimizationWorkerKind, number] => entry[1] > 0,
  );

const issueCounts = (
  matchingJobs: readonly AudioOptimizationJob[],
): Array<[AudioOptimizationIssueKind, number]> => {
  const counts = new Map<AudioOptimizationIssueKind, number>();
  for (const job of matchingJobs) {
    const kind = classifyAudioOptimizationIssue(job.error).kind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    ([leftKind, leftCount], [rightKind, rightCount]) =>
      rightCount - leftCount || leftKind.localeCompare(rightKind),
  );
};

const unclassifiedFailureDetails = (
  matchingJobs: readonly AudioOptimizationJob[],
): Array<[string, number]> => {
  const counts = new Map<string, number>();
  for (const job of matchingJobs) {
    if (classifyAudioOptimizationIssue(job.error).kind !== "UNKNOWN") continue;
    const detail = job.error?.trim() || "Audiooptimierung fehlgeschlagen.";
    counts.set(detail, (counts.get(detail) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      ([leftMessage, leftCount], [rightMessage, rightCount]) =>
        rightCount - leftCount || leftMessage.localeCompare(rightMessage),
    )
    .slice(0, 5);
};

export const audioOptimizationSummary = () => {
  void ensureHydrated();
  const originalBytes = jobs.reduce((sum, job) => sum + job.originalBytes, 0);
  const optimizedBytes = jobs.reduce(
    (sum, job) => sum + (job.optimizedBytes || job.originalBytes),
    0,
  );
  const contributors = contributionCounts(
    jobs.filter((job) => job.status === "COMPLETE"),
  );
  const failedContributors = contributionCounts(
    jobs.filter((job) =>
      ["FAILED_RETRYABLE", "FAILED_FINAL"].includes(job.status),
    ),
  );
  const failedJobs = jobs.filter((job) =>
    ["FAILED_RETRYABLE", "FAILED_FINAL"].includes(job.status),
  );
  const unsupportedJobs = jobs.filter((job) => job.status === "UNSUPPORTED");
  const deferredJob = [...jobs]
    .filter((job) => job.checkpoint === "DEFERRED_DEVICE_PROTECTION")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const lastFailedJob = [...failedJobs].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )[0];
  const complete = jobs.filter((job) => job.status === "COMPLETE").length;
  const keptOriginal = jobs.filter(
    (job) => job.status === "KEPT_ORIGINAL",
  ).length;
  return {
    total: jobs.length,
    complete,
    pending: jobs.filter((job) =>
      ["PENDING", "ANALYZING", "PROCESSING", "ENCODING", "VERIFYING"].includes(
        job.status,
      ),
    ).length,
    failed: failedJobs.length,
    unsupported: unsupportedJobs.length,
    keptOriginal,
    processed:
      complete +
      keptOriginal +
      unsupportedJobs.length +
      jobs.filter((job) => job.status === "FAILED_FINAL").length,
    deferred: jobs.filter(
      (job) => job.checkpoint === "DEFERRED_DEVICE_PROTECTION",
    ).length,
    originalBytes,
    optimizedBytes,
    savedBytes: jobs.reduce((sum, job) => sum + job.potentialSavedBytes, 0),
    paused: isPaused(),
    running: activeRun !== null && !isPaused(),
    suspensionReason: audioOptimizationSuspensionReason(deferredJob?.error),
    lastError: lastFailedJob?.error?.trim() || undefined,
    current: jobs.find((job) =>
      ["ANALYZING", "PROCESSING", "ENCODING", "VERIFYING"].includes(job.status),
    ),
    contributors,
    failedContributors,
    failureReasons: issueCounts(failedJobs),
    unclassifiedFailureDetails: unclassifiedFailureDetails(failedJobs),
    unsupportedReasons: issueCounts(unsupportedJobs),
  };
};

export function pauseLocalAudioOptimization(): void {
  localStorage.setItem(pausedStorageKey, "1");
  if (automaticRetryTimer !== null) {
    clearTimeout(automaticRetryTimer);
    automaticRetryTimer = null;
  }
  notify();
}

export function resumeLocalAudioOptimization(): Promise<void> {
  localStorage.removeItem(pausedStorageKey);
  notify();
  return startLocalAudioOptimization();
}

export async function retryFailedLocalAudioOptimization(): Promise<void> {
  await ensureHydrated();
  for (const job of jobs) {
    if (job.status !== "FAILED_RETRYABLE" && job.status !== "FAILED_FINAL")
      continue;
    await patchJob(job.mediaId, {
      status: "PENDING",
      checkpoint: "RETRY_REQUESTED",
      attempts: 0,
      error: undefined,
    });
  }
  await resumeLocalAudioOptimization();
}

export function enqueueLocalAudioOptimization(
  mediaIds: readonly string[],
): void {
  void (async () => {
    await ensureHydrated();
    const known = new Set(jobs.map((job) => job.mediaId));
    for (const mediaId of mediaIds) {
      if (known.has(mediaId)) continue;
      const job = audioOptimizationJobSchema.parse({
        mediaId,
        status: "PENDING",
        checkpoint: "QUEUED",
        attempts: 0,
        pipelineVersion: speechAudioPipeline.version,
        originalBytes: 0,
        optimizedBytes: 0,
        potentialSavedBytes: 0,
        updatedAt: new Date().toISOString(),
      });
      await storage.put(job);
      jobs.push(job);
      known.add(mediaId);
    }
    notify();
    await startLocalAudioOptimization();
  })();
}

const discoverAudioJobs = async (): Promise<void> => {
  const repository = await localProductRepository();
  const [references, derivatives] = await Promise.all([
    repository.listMedia(),
    repository.listAudioDerivatives(),
  ]);
  const completedSources = new Set(
    derivatives
      .filter(
        (derivative) =>
          derivative.payload.pipelineId === speechAudioPipeline.id &&
          derivative.payload.pipelineVersion === speechAudioPipeline.version,
      )
      .map((derivative) => derivative.payload.sourceMediaId),
  );
  const derivativeOutputs = new Set(
    derivatives.map((derivative) => derivative.payload.outputMediaId),
  );
  const candidates = references
    .filter(
      (reference) =>
        reference.payload.mimeType.startsWith("audio/") &&
        !isAudioDerivativeReferenceFileName(reference.payload.fileName) &&
        !derivativeOutputs.has(reference.id) &&
        !completedSources.has(reference.id),
    )
    .map((reference) => reference.id);
  const known = new Map(jobs.map((job) => [job.mediaId, job]));
  for (const mediaId of candidates) {
    const existing = known.get(mediaId);
    if (
      existing?.pipelineVersion === speechAudioPipeline.version &&
      nativeDecodeFailureCanUseBrowserFallback(existing)
    ) {
      await patchJob(mediaId, {
        status: "PENDING",
        checkpoint: "BROWSER_COMPATIBILITY_FALLBACK",
        attempts: 0,
        error: undefined,
      });
      continue;
    }
    if (existing?.pipelineVersion === speechAudioPipeline.version) continue;
    if (existing) {
      await patchJob(mediaId, {
        status: "PENDING",
        checkpoint: "PIPELINE_UPGRADE",
        attempts: 0,
        pipelineVersion: speechAudioPipeline.version,
        error: undefined,
      });
      continue;
    }
    const job = audioOptimizationJobSchema.parse({
      mediaId,
      status: "PENDING",
      checkpoint: "DISCOVERED",
      attempts: 0,
      pipelineVersion: speechAudioPipeline.version,
      originalBytes: 0,
      optimizedBytes: 0,
      potentialSavedBytes: 0,
      updatedAt: new Date().toISOString(),
    });
    await storage.put(job);
    jobs.push(job);
    known.set(mediaId, job);
  }
  if (candidates.length) notify();
};

const scheduleAutomaticRetry = (): void => {
  if (automaticRetryTimer !== null || isPaused()) return;
  automaticRetryTimer = setTimeout(() => {
    automaticRetryTimer = null;
    void startLocalAudioOptimization();
  }, automaticRetryDelayMs);
};

const optimizeAudioNatively = async (
  original: Blob,
): Promise<LocalAudioEngineResult> => {
  const jobId = crypto.randomUUID();
  await nativeAudio.begin({
    jobId,
    fileExtension: extensionFor(original.type),
  });
  try {
    for (let offset = 0; offset < original.size; offset += 48 * 1024) {
      const bytes = new Uint8Array(
        await original.slice(offset, offset + 48 * 1024).arrayBuffer(),
      );
      await nativeAudio.appendInput({
        jobId,
        dataBase64: bytesToBase64(bytes),
      });
    }
    const result = await nativeAudio.optimizeFile({ jobId });
    const output = new Uint8Array(result.optimized ? result.optimizedBytes : 0);
    let offset = 0;
    while (offset < output.byteLength) {
      const chunk = await nativeAudio.readOutput({
        jobId,
        offset,
        length: Math.min(48 * 1024, output.byteLength - offset),
      });
      const bytes = base64ToBytes(chunk.dataBase64);
      output.set(bytes, offset);
      offset += bytes.byteLength;
      if (!bytes.byteLength || (chunk.eof && offset < output.byteLength)) {
        throw new Error("Das native Audioergebnis ist unvollständig.");
      }
    }
    return { ...result, bytes: output };
  } finally {
    await nativeAudio.cleanup({ jobId }).catch(() => undefined);
  }
};

const workerLabel = (): string => {
  if (Capacitor.isNativePlatform()) return "iPhone/iPad";
  return "Browser/PC";
};

const engineAvailable = (): boolean =>
  Capacitor.isNativePlatform() || browserAudioOptimizationAvailable();

const optimize = (original: Blob): Promise<LocalAudioEngineResult> =>
  Capacitor.isNativePlatform()
    ? optimizeAudioNatively(original).catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (
          classifyAudioOptimizationIssue(message).kind === "FORMAT_OR_DECODE" &&
          browserAudioOptimizationAvailable()
        ) {
          return optimizeAudioInBrowser(original);
        }
        throw cause;
      })
    : optimizeAudioInBrowser(original);

const nativeDecodeFailureCanUseBrowserFallback = (
  job: AudioOptimizationJob,
): boolean =>
  Capacitor.isNativePlatform() &&
  browserAudioOptimizationAvailable() &&
  job.status === "UNSUPPORTED" &&
  job.checkpoint === "UNSUPPORTED_INPUT" &&
  classifyAudioOptimizationIssue(job.error).kind === "FORMAT_OR_DECODE";

const processJob = async (
  job: AudioOptimizationJob,
  deviceId: string,
): Promise<void> => {
  const original = await getLocalProductOriginalMedia(job.mediaId);
  if (!original) {
    throw new Error("Originalaudio fehlt.");
  }
  if (original.size > speechAudioPipeline.maximumInputBytes) {
    await patchJob(job.mediaId, {
      status: "UNSUPPORTED",
      checkpoint: "POLICY_LIMIT",
      originalBytes: original.size,
      optimizedBytes: original.size,
      error: "Audio ist größer als 16 MiB.",
    });
    return;
  }
  await patchJob(job.mediaId, {
    status: "ANALYZING",
    checkpoint: "INPUT_STORED",
    attempts: job.attempts + 1,
    originalBytes: original.size,
    optimizedBytes: original.size,
    workerDeviceId: deviceId,
    workerLabel: workerLabel(),
    pipelineVersion: speechAudioPipeline.version,
    error: undefined,
  });
  const result = await optimize(original);
  if (!result.optimized || !result.bytes.byteLength) {
    await patchJob(job.mediaId, {
      status: "KEPT_ORIGINAL",
      checkpoint: "NO_SAFE_SAVING",
      engine: result.engine,
      optimizedBytes: original.size,
      potentialSavedBytes: 0,
    });
    return;
  }
  if (
    result.bytes.byteLength !== result.optimizedBytes ||
    result.bytes.byteLength >= original.size
  ) {
    throw new Error("Das geprüfte Audioergebnis hat eine ungültige Größe.");
  }
  await patchJob(job.mediaId, {
    status: "VERIFYING",
    checkpoint: "ENGINE_VERIFIED",
    engine: result.engine,
  });
  await installOptimizedLocalAudio({
    originalMediaId: job.mediaId,
    mimeType: result.mimeType,
    bytes: result.bytes,
    engine: result.engine,
    engineVersion: result.engineVersion,
    inputMeasurement: result.inputMeasurement as AudioQualityMeasurement,
    outputMeasurement: result.outputMeasurement as AudioQualityMeasurement,
  });
  await patchJob(job.mediaId, {
    status: "COMPLETE",
    checkpoint: "COMPARISON_READY",
    originalBytes: original.size,
    optimizedBytes: result.bytes.byteLength,
    potentialSavedBytes: original.size - result.bytes.byteLength,
  });
};

export function startLocalAudioOptimization(): Promise<void> {
  if (activeRun) return activeRun;
  const run = (async () => {
    await ensureHydrated();
    await pruneMissingAudioJobs();
    if (isPaused() || !engineAvailable()) return;
    await (await localProductRepository()).cleanupActivatedAudioOriginals();
    await discoverAudioJobs();
    const identity = await getOrCreateDeviceIdentity();
    for (const job of [...jobs]) {
      if (isPaused()) break;
      if (job.status !== "PENDING" && job.status !== "FAILED_RETRYABLE")
        continue;
      const repository = await localProductRepository();
      const installedDerivative = (
        await repository.listAudioDerivatives(job.mediaId)
      )[0];
      const installedBytes = installedDerivative
        ? await repository.getMedia(installedDerivative.payload.outputMediaId)
        : null;
      if (
        installedDerivative &&
        installedBytes &&
        installedBytes.sha256 === installedDerivative.payload.outputSha256 &&
        installedBytes.bytes.byteLength ===
          installedDerivative.payload.outputBytes
      ) {
        await patchJob(job.mediaId, {
          status: "COMPLETE",
          checkpoint:
            installedDerivative.payload.createdByDeviceId === identity.id
              ? "RECOVERED_LOCAL_RESULT"
              : "RECEIVED_FROM_PEER",
          originalBytes: installedDerivative.payload.sourceBytes,
          optimizedBytes: installedDerivative.payload.outputBytes,
          potentialSavedBytes: Math.max(
            0,
            installedDerivative.payload.sourceBytes -
              installedDerivative.payload.outputBytes,
          ),
          workerDeviceId: installedDerivative.payload.createdByDeviceId,
          workerLabel: workerLabelForEngine(installedDerivative.payload.engine),
          engine: installedDerivative.payload.engine,
          pipelineVersion: speechAudioPipeline.version,
        });
        continue;
      }
      const connectedPeerDeviceId = directConnectionIsConnected()
        ? directPeerDeviceId()
        : undefined;
      if (
        !audioJobBelongsToDevice({
          mediaId: job.mediaId,
          localDeviceId: identity.id,
          connectedPeerDeviceId,
        })
      ) {
        continue;
      }
      try {
        await processJob(job, identity.id);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Audiooptimierung fehlgeschlagen.";
        const issue = classifyAudioOptimizationIssue(message);
        const attempts =
          jobs.find((candidate) => candidate.mediaId === job.mediaId)
            ?.attempts ?? job.attempts + 1;
        if (issue.disposition === "DEFER") {
          await patchJob(job.mediaId, {
            status: "PENDING",
            checkpoint: "DEFERRED_DEVICE_PROTECTION",
            attempts: Math.max(0, attempts - 1),
            error: message.replace(
              /^DEFERRED(?:_(?:BATTERY|THERMAL))?:\s*/i,
              "",
            ),
          });
          scheduleAutomaticRetry();
          break;
        }
        if (issue.disposition === "UNSUPPORTED") {
          await patchJob(job.mediaId, {
            status: "UNSUPPORTED",
            checkpoint: "UNSUPPORTED_INPUT",
            error: message.replace(/^UNSUPPORTED:\s*/i, ""),
          });
          continue;
        }
        await patchJob(job.mediaId, {
          status: attempts >= 3 ? "FAILED_FINAL" : "FAILED_RETRYABLE",
          checkpoint: "FAILED",
          error: message,
        });
        if (attempts < 3) scheduleAutomaticRetry();
      }
    }
  })();
  const tracked = run.finally(() => {
    if (activeRun === tracked) {
      activeRun = null;
      notify();
    }
  });
  activeRun = tracked;
  notify();
  return tracked;
}
