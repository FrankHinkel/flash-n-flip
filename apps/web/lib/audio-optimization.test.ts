import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jobs: new Map<string, unknown>(),
  getMedia: vi.fn(),
  installOptimized: vi.fn(),
  listMedia: vi.fn().mockResolvedValue([]),
  listDerivatives: vi.fn().mockResolvedValue([]),
  repositoryGetMedia: vi.fn().mockResolvedValue(null),
  cleanupActivatedOriginals: vi.fn().mockResolvedValue(0),
  begin: vi.fn(),
  appendInput: vi.fn(),
  optimizeFile: vi.fn(),
  readOutput: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    begin: mocks.begin,
    appendInput: mocks.appendInput,
    optimizeFile: mocks.optimizeFile,
    readOutput: mocks.readOutput,
    cleanup: mocks.cleanup,
  }),
}));

vi.mock(
  "@flashcards/direct-connect-webstack/audio-optimization-storage",
  () => ({
    createLocalAudioOptimizationStorage: () => ({
      list: async () => [...mocks.jobs.values()],
      put: async (job: { mediaId: string }) => mocks.jobs.set(job.mediaId, job),
      delete: async (mediaId: string) => mocks.jobs.delete(mediaId),
    }),
  }),
);

vi.mock("@flashcards/direct-connect-webstack/connection-state", () => ({
  directConnectionIsConnected: () => false,
  directPeerDeviceId: () => null,
}));

vi.mock("@flashcards/direct-connect-webstack/identity", () => ({
  getOrCreateDeviceIdentity: async () => ({
    id: "00000000-0000-4000-8000-000000000099",
  }),
}));

vi.mock("./browser-audio-optimizer", () => ({
  browserAudioOptimizationAvailable: () => false,
  optimizeAudioInBrowser: vi.fn(),
}));

vi.mock("./local-product-repository", () => ({
  getLocalProductMedia: mocks.getMedia,
  installOptimizedLocalAudio: mocks.installOptimized,
  localProductRepository: async () => ({
    listMedia: mocks.listMedia,
    listAudioDerivatives: mocks.listDerivatives,
    getMedia: mocks.repositoryGetMedia,
    cleanupActivatedAudioOriginals: mocks.cleanupActivatedOriginals,
  }),
}));

const localStorageValues = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => localStorageValues.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageValues.set(key, value),
  removeItem: (key: string) => localStorageValues.delete(key),
  clear: () => localStorageValues.clear(),
};

const measurement = {
  durationSeconds: 1,
  integratedLufs: -18,
  truePeakDb: -2,
  sampleRate: 24_000,
  channels: 1,
};

const loadSubject = async () => {
  vi.resetModules();
  return import("./audio-optimization");
};

const waitFor = async (predicate: () => boolean) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Audio optimization did not settle.");
};

beforeEach(() => {
  mocks.jobs.clear();
  localStorageValues.clear();
  mocks.getMedia.mockReset();
  mocks.installOptimized.mockReset();
  mocks.listMedia.mockReset().mockResolvedValue([]);
  mocks.listDerivatives.mockReset().mockResolvedValue([]);
  mocks.repositoryGetMedia.mockReset().mockResolvedValue(null);
  mocks.cleanupActivatedOriginals.mockReset().mockResolvedValue(0);
  mocks.begin.mockReset().mockResolvedValue(undefined);
  mocks.appendInput
    .mockReset()
    .mockResolvedValue({ receivedBytes: 6, totalBytes: 6 });
  mocks.optimizeFile.mockReset();
  mocks.readOutput.mockReset();
  mocks.cleanup.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("localStorage", localStorageStub);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { documentElement: { dataset: {} } });
  vi.stubGlobal("CustomEvent", Event);
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-000000000777",
  });
});

describe("local audio optimization", () => {
  it("installs a verified derivative and records actually freed bytes", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000101";
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4, 5, 6])], { type: "audio/wav" }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: true,
      mimeType: "audio/mp4",
      originalBytes: 6,
      optimizedBytes: 3,
      engine: "native-test",
      engineVersion: "2",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });
    mocks.readOutput.mockResolvedValue({
      dataBase64: btoa(String.fromCharCode(7, 8, 9)),
      eof: true,
    });

    subject.enqueueLocalAudioOptimization([mediaId]);
    await waitFor(() => subject.audioOptimizationSummary().complete === 1);

    expect(mocks.installOptimized).toHaveBeenCalledWith({
      originalMediaId: mediaId,
      mimeType: "audio/mp4",
      bytes: Uint8Array.from([7, 8, 9]),
      engine: "native-test",
      engineVersion: "2",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });
    expect(subject.audioOptimizationSummary()).toMatchObject({
      failed: 0,
      originalBytes: 6,
      optimizedBytes: 3,
      savedBytes: 3,
    });
  });

  it("restores an interrupted durable job as pending and resumes it", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000102";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "ENCODING",
      checkpoint: "NATIVE_FILE",
      attempts: 1,
      originalBytes: 4,
      optimizedBytes: 4,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-11T12:00:00.000Z",
    });
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/mpeg" }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes: 4,
      optimizedBytes: 4,
      engine: "native-test",
      engineVersion: "2",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });
    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "KEPT_ORIGINAL",
      attempts: 2,
    });
    expect(mocks.installOptimized).not.toHaveBeenCalled();
  });

  it("migrates systemically failed legacy jobs back to pending before retrying", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000104";
    localStorageValues.set(
      "flash-n-flip.audio-optimization.v1",
      JSON.stringify([
        {
          mediaId,
          status: "FAILED",
          originalBytes: 4,
          optimizedBytes: 4,
          error: "FlashNFlipAudio.optimize is not implemented",
        },
      ]),
    );
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/mpeg" }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes: 4,
      optimizedBytes: 4,
      engine: "native-test",
      engineVersion: "2",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      mediaId,
      status: "KEPT_ORIGINAL",
      attempts: 1,
      checkpoint: "NO_SAFE_SAVING",
    });
    expect(localStorageValues.has("flash-n-flip.audio-optimization.v1")).toBe(
      false,
    );
  });

  it("does not delete or replace the original after an engine failure", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000103";
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/wav" }),
    );
    mocks.optimizeFile.mockRejectedValue(new Error("codec unavailable"));

    subject.enqueueLocalAudioOptimization([mediaId]);
    await waitFor(() => subject.audioOptimizationSummary().failed === 1);

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "FAILED_RETRYABLE",
      error: "codec unavailable",
    });
    expect(mocks.installOptimized).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalled();
  });
});
