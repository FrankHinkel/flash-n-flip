import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMedia: vi.fn(),
  installOptimized: vi.fn(),
  optimize: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ optimize: mocks.optimize }),
}));

vi.mock("./local-product-repository", () => ({
  getLocalProductMedia: mocks.getMedia,
  installOptimizedLocalAudio: mocks.installOptimized,
}));

import {
  audioOptimizationSummary,
  enqueueLocalAudioOptimization,
  pauseLocalAudioOptimization,
  resumeLocalAudioOptimization,
  retryFailedLocalAudioOptimization,
} from "./audio-optimization";

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Audio optimization did not settle.");
};

beforeEach(() => {
  storage.clear();
  mocks.getMedia.mockReset();
  mocks.installOptimized.mockReset();
  mocks.optimize.mockReset();
  vi.stubGlobal("localStorage", localStorageStub);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("CustomEvent", Event);
});

describe("local audio optimization", () => {
  it("keeps the original and records the smaller playback derivative", async () => {
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4, 5, 6])], {
        type: "audio/wav",
      }),
    );
    mocks.optimize.mockResolvedValue({
      optimized: true,
      mimeType: "audio/mp4",
      originalBytes: 6,
      optimizedBytes: 3,
      dataBase64: btoa(String.fromCharCode(7, 8, 9)),
    });

    enqueueLocalAudioOptimization(["audio-original"]);
    await waitFor(() => audioOptimizationSummary().pending === 0);

    expect(mocks.installOptimized).toHaveBeenCalledWith({
      originalMediaId: "audio-original",
      mimeType: "audio/mp4",
      bytes: Uint8Array.from([7, 8, 9]),
    });
    expect(audioOptimizationSummary()).toMatchObject({
      failed: 0,
      originalBytes: 6,
      optimizedBytes: 3,
      savedBytes: 3,
    });
  });

  it("pauses before the next job and resumes explicitly", async () => {
    pauseLocalAudioOptimization();
    enqueueLocalAudioOptimization(["audio-paused"]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(audioOptimizationSummary()).toMatchObject({
      pending: 1,
      paused: true,
    });
    expect(mocks.optimize).not.toHaveBeenCalled();

    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3])], { type: "audio/mpeg" }),
    );
    mocks.optimize.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mpeg",
      originalBytes: 3,
      optimizedBytes: 3,
      dataBase64: "",
    });
    await resumeLocalAudioOptimization();

    expect(audioOptimizationSummary()).toMatchObject({
      pending: 0,
      paused: false,
      optimizedBytes: 3,
    });
  });

  it("makes failed jobs retryable without replacing their originals", async () => {
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/wav" }),
    );
    mocks.optimize.mockRejectedValueOnce(new Error("codec unavailable"));

    enqueueLocalAudioOptimization(["audio-retry"]);
    await waitFor(() => audioOptimizationSummary().failed === 1);

    mocks.optimize.mockResolvedValue({
      optimized: false,
      mimeType: "audio/wav",
      originalBytes: 4,
      optimizedBytes: 4,
      dataBase64: "",
    });
    await retryFailedLocalAudioOptimization();

    expect(audioOptimizationSummary()).toMatchObject({ failed: 0, pending: 0 });
    expect(mocks.getMedia).toHaveBeenCalledTimes(2);
    expect(mocks.installOptimized).not.toHaveBeenCalled();
  });
});
