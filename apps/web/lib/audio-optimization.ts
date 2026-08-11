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
  getLocalProductMedia,
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

export const audioOptimizationSummary = () => {
  void ensureHydrated();
  const originalBytes = jobs.reduce((sum, job) => sum + job.originalBytes, 0);
  const optimizedBytes = jobs.reduce(
    (sum, job) => sum + (job.optimizedBytes || job.originalBytes),
    0,
  );
  const contributors = Object.entries(
    jobs
      .filter((job) => job.status === "COMPLETE" && job.workerLabel)
      .reduce<Record<string, number>>((result, job) => {
        result[job.workerLabel!] = (result[job.workerLabel!] ?? 0) + 1;
        return result;
      }, {}),
  ).sort(([left], [right]) => left.localeCompare(right));
  return {
    total: jobs.length,
    complete: jobs.filter((job) => job.status === "COMPLETE").length,
    pending: jobs.filter((job) =>
      ["PENDING", "ANALYZING", "PROCESSING", "ENCODING", "VERIFYING"].includes(
        job.status,
      ),
    ).length,
    failed: jobs.filter((job) =>
      ["FAILED_RETRYABLE", "FAILED_FINAL"].includes(job.status),
    ).length,
    unsupported: jobs.filter((job) => job.status === "UNSUPPORTED").length,
    originalBytes,
    optimizedBytes,
    savedBytes: jobs.reduce((sum, job) => sum + job.potentialSavedBytes, 0),
    paused: isPaused(),
    current: jobs.find((job) =>
      ["ANALYZING", "PROCESSING", "ENCODING", "VERIFYING"].includes(job.status),
    ),
    contributors,
  };
};

export function pauseLocalAudioOptimization(): void {
  localStorage.setItem(pausedStorageKey, "1");
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
    derivatives.map((derivative) => derivative.payload.sourceMediaId),
  );
  const derivativeOutputs = new Set(
    derivatives.map((derivative) => derivative.payload.outputMediaId),
  );
  const candidates = references
    .filter(
      (reference) =>
        reference.payload.mimeType.startsWith("audio/") &&
        !derivativeOutputs.has(reference.id) &&
        !completedSources.has(reference.id),
    )
    .map((reference) => reference.id);
  const known = new Set(jobs.map((job) => job.mediaId));
  for (const mediaId of candidates) {
    if (known.has(mediaId)) continue;
    const job = audioOptimizationJobSchema.parse({
      mediaId,
      status: "PENDING",
      checkpoint: "DISCOVERED",
      attempts: 0,
      originalBytes: 0,
      optimizedBytes: 0,
      potentialSavedBytes: 0,
      updatedAt: new Date().toISOString(),
    });
    await storage.put(job);
    jobs.push(job);
  }
  if (candidates.length) notify();
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
    ? optimizeAudioNatively(original)
    : optimizeAudioInBrowser(original);

const processJob = async (
  job: AudioOptimizationJob,
  deviceId: string,
): Promise<void> => {
  const original = await getLocalProductMedia(job.mediaId);
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
  if (isPaused() || !engineAvailable()) return Promise.resolve();
  activeRun ??= (async () => {
    await ensureHydrated();
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
        installedBytes?.sha256 === installedDerivative.payload.outputSha256 &&
        installedBytes.bytes.byteLength ===
          installedDerivative.payload.outputBytes
      ) {
        await patchJob(job.mediaId, {
          status: "COMPLETE",
          checkpoint: "RECEIVED_FROM_PEER",
          originalBytes: installedDerivative.payload.sourceBytes,
          optimizedBytes: installedDerivative.payload.outputBytes,
          potentialSavedBytes: Math.max(
            0,
            installedDerivative.payload.sourceBytes -
              installedDerivative.payload.outputBytes,
          ),
          workerDeviceId: installedDerivative.payload.createdByDeviceId,
          workerLabel: "Verbundenes Gerät",
          engine: installedDerivative.payload.engine,
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
        const attempts =
          jobs.find((candidate) => candidate.mediaId === job.mediaId)
            ?.attempts ?? job.attempts + 1;
        await patchJob(job.mediaId, {
          status: message.startsWith("UNSUPPORTED:")
            ? "UNSUPPORTED"
            : attempts >= 3
              ? "FAILED_FINAL"
              : "FAILED_RETRYABLE",
          checkpoint: "FAILED",
          error: message.replace(/^UNSUPPORTED:\s*/, ""),
        });
      }
    }
  })().finally(() => {
    activeRun = null;
  });
  return activeRun;
}
