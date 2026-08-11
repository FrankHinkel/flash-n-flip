"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

import {
  getLocalProductMedia,
  installOptimizedLocalAudio,
} from "./local-product-repository";

const storageKey = "flash-n-flip.audio-optimization.v1";
const pausedStorageKey = "flash-n-flip.audio-optimization.paused.v1";
export const audioOptimizationChangedEvent =
  "flash-n-flip:audio-optimization-changed";

type AudioOptimizationResult = {
  optimized: boolean;
  mimeType: string;
  originalBytes: number;
  optimizedBytes: number;
  dataBase64: string;
};

type AudioPlugin = {
  optimize(input: {
    dataBase64: string;
    mimeType: string;
  }): Promise<AudioOptimizationResult>;
};

export type AudioOptimizationJob = {
  mediaId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETE" | "KEPT" | "FAILED";
  originalBytes: number;
  optimizedBytes: number;
  updatedAt: string;
  error?: string;
};

const nativeAudio = registerPlugin<AudioPlugin>("FlashNFlipAudio");
let activeRun: Promise<void> | null = null;

const readJobs = (): AudioOptimizationJob[] => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(storageKey) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((job): job is AudioOptimizationJob =>
      Boolean(
        job &&
        typeof job === "object" &&
        "mediaId" in job &&
        typeof job.mediaId === "string" &&
        "status" in job &&
        typeof job.status === "string",
      ),
    );
  } catch {
    return [];
  }
};

const writeJobs = (jobs: readonly AudioOptimizationJob[]) => {
  localStorage.setItem(storageKey, JSON.stringify(jobs));
  window.dispatchEvent(new CustomEvent(audioOptimizationChangedEvent));
};

const isPaused = (): boolean => localStorage.getItem(pausedStorageKey) === "1";

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const patchJob = (
  jobs: AudioOptimizationJob[],
  mediaId: string,
  patch: Partial<AudioOptimizationJob>,
) => {
  const index = jobs.findIndex((job) => job.mediaId === mediaId);
  if (index < 0) return;
  jobs[index] = {
    ...jobs[index]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeJobs(jobs);
};

export const audioOptimizationJobs = (): readonly AudioOptimizationJob[] =>
  readJobs();

export const audioOptimizationSummary = () => {
  const jobs = readJobs();
  const originalBytes = jobs.reduce((sum, job) => sum + job.originalBytes, 0);
  const currentBytes = jobs.reduce(
    (sum, job) => sum + (job.optimizedBytes || job.originalBytes),
    0,
  );
  return {
    total: jobs.length,
    pending: jobs.filter(
      (job) => job.status === "PENDING" || job.status === "PROCESSING",
    ).length,
    failed: jobs.filter((job) => job.status === "FAILED").length,
    originalBytes,
    optimizedBytes: currentBytes,
    savedBytes: Math.max(0, originalBytes - currentBytes),
    paused: isPaused(),
  };
};

export function pauseLocalAudioOptimization(): void {
  localStorage.setItem(pausedStorageKey, "1");
  window.dispatchEvent(new CustomEvent(audioOptimizationChangedEvent));
}

export function resumeLocalAudioOptimization(): Promise<void> {
  localStorage.removeItem(pausedStorageKey);
  window.dispatchEvent(new CustomEvent(audioOptimizationChangedEvent));
  return startLocalAudioOptimization();
}

export function retryFailedLocalAudioOptimization(): Promise<void> {
  const jobs = readJobs().map((job) =>
    job.status === "FAILED"
      ? {
          ...job,
          status: "PENDING" as const,
          error: undefined,
          updatedAt: new Date().toISOString(),
        }
      : job,
  );
  writeJobs(jobs);
  return resumeLocalAudioOptimization();
}

export function enqueueLocalAudioOptimization(mediaIds: readonly string[]) {
  if (!Capacitor.isNativePlatform()) return;
  const jobs = readJobs();
  const known = new Set(jobs.map((job) => job.mediaId));
  for (const mediaId of mediaIds) {
    if (known.has(mediaId)) continue;
    jobs.push({
      mediaId,
      status: "PENDING",
      originalBytes: 0,
      optimizedBytes: 0,
      updatedAt: new Date().toISOString(),
    });
  }
  writeJobs(jobs);
  void startLocalAudioOptimization();
}

export function startLocalAudioOptimization(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (isPaused()) return Promise.resolve();
  activeRun ??= (async () => {
    const jobs = readJobs();
    for (const job of jobs) {
      if (isPaused()) break;
      if (job.status !== "PENDING" && job.status !== "PROCESSING") continue;
      try {
        const original = await getLocalProductMedia(job.mediaId);
        if (!original) throw new Error("Originalaudio fehlt.");
        patchJob(jobs, job.mediaId, {
          status: "PROCESSING",
          originalBytes: original.size,
          optimizedBytes: original.size,
          error: undefined,
        });
        const bytes = new Uint8Array(await original.arrayBuffer());
        const result = await nativeAudio.optimize({
          dataBase64: bytesToBase64(bytes),
          mimeType: original.type || "application/octet-stream",
        });
        if (!result.optimized || !result.dataBase64) {
          patchJob(jobs, job.mediaId, {
            status: "KEPT",
            originalBytes: result.originalBytes || original.size,
            optimizedBytes: result.originalBytes || original.size,
          });
          continue;
        }
        const optimized = base64ToBytes(result.dataBase64);
        if (
          optimized.byteLength !== result.optimizedBytes ||
          optimized.byteLength >= original.size
        ) {
          throw new Error(
            "Das Audio-Derivat ist nicht kleiner als das Original.",
          );
        }
        await installOptimizedLocalAudio({
          originalMediaId: job.mediaId,
          mimeType: result.mimeType,
          bytes: optimized,
        });
        patchJob(jobs, job.mediaId, {
          status: "COMPLETE",
          originalBytes: original.size,
          optimizedBytes: optimized.byteLength,
        });
      } catch (cause) {
        patchJob(jobs, job.mediaId, {
          status: "FAILED",
          error:
            cause instanceof Error
              ? cause.message
              : "Audiooptimierung fehlgeschlagen.",
        });
      }
    }
  })().finally(() => {
    activeRun = null;
  });
  return activeRun;
}
