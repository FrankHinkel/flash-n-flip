import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  browserAvailable: false,
  optimizeInBrowser: vi.fn(),
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
  browserAudioOptimizationAvailable: () => mocks.browserAvailable,
  optimizeAudioInBrowser: mocks.optimizeInBrowser,
}));

vi.mock("./local-product-repository", () => ({
  getLocalProductOriginalMedia: mocks.getMedia,
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
  integratedLufs: -16,
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
  mocks.browserAvailable = false;
  mocks.optimizeInBrowser.mockReset();
  vi.stubGlobal("localStorage", localStorageStub);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { documentElement: { dataset: {} } });
  vi.stubGlobal("CustomEvent", Event);
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-000000000777",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("local audio optimization", () => {
  it("classifies policy, format, device-protection and processing errors", async () => {
    const subject = await loadSubject();

    expect(
      subject.classifyAudioOptimizationIssue(
        "DEFERRED: Audio optimization is paused to protect battery and temperature",
      ),
    ).toEqual({ kind: "DEVICE_PROTECTION", disposition: "DEFER" });
    expect(
      subject.classifyAudioOptimizationIssue(
        "DEFERRED_THERMAL: Audio optimization is paused while the device cools down",
      ),
    ).toEqual({ kind: "DEVICE_PROTECTION", disposition: "DEFER" });
    expect(
      subject.audioOptimizationSuspensionReason(
        "Audio optimization is paused while the device cools down",
      ),
    ).toBe("THERMAL");
    expect(
      subject.audioOptimizationSuspensionReason(
        "Audio optimization is paused to protect the battery",
      ),
    ).toBe("BATTERY");
    expect(
      subject.classifyAudioOptimizationIssue(
        "UNSUPPORTED: Audio has no decodable audio track",
      ),
    ).toEqual({ kind: "FORMAT_OR_DECODE", disposition: "UNSUPPORTED" });
    expect(
      subject.classifyAudioOptimizationIssue("Audio ist größer als 16 MiB."),
    ).toEqual({ kind: "SIZE_LIMIT", disposition: "UNSUPPORTED" });
    expect(
      subject.classifyAudioOptimizationIssue(
        "Die lokale Audiokodierung ist fehlgeschlagen.",
      ),
    ).toEqual({ kind: "ENCODING", disposition: "RETRY" });
    expect(
      subject.classifyAudioOptimizationIssue(
        "UNSUPPORTED: Audio is empty or has an invalid size",
      ),
    ).toEqual({ kind: "EMPTY", disposition: "UNSUPPORTED" });
    expect(
      subject.classifyAudioOptimizationIssue(
        "UNSUPPORTED: Audio is longer than 30 minutes",
      ),
    ).toEqual({ kind: "DURATION_LIMIT", disposition: "UNSUPPORTED" });
    expect(
      subject.classifyAudioOptimizationIssue(
        "Die Lautheitsanalyse lieferte kein Ergebnis.",
      ),
    ).toEqual({
      kind: "TOO_SHORT_OR_SILENT",
      disposition: "UNSUPPORTED",
    });
    expect(
      subject.classifyAudioOptimizationIssue("Originalaudio fehlt."),
    ).toEqual({ kind: "STORAGE", disposition: "RETRY" });
    expect(
      subject.classifyAudioOptimizationIssue(
        "Der lokale Browser-Audioworker ist hier nicht verfügbar.",
      ),
    ).toEqual({ kind: "ENGINE_UNAVAILABLE", disposition: "RETRY" });
  });

  it("reports mutually exhaustive status counts", async () => {
    const statuses = [
      "COMPLETE",
      "PENDING",
      "KEPT_ORIGINAL",
      "UNSUPPORTED",
      "FAILED_FINAL",
    ] as const;
    const mediaIds = statuses.map(
      (_, index) =>
        `00000000-0000-4000-8000-${String(index + 130).padStart(12, "0")}`,
    );
    statuses.forEach((status, index) => {
      mocks.jobs.set(mediaIds[index]!, {
        mediaId: mediaIds[index],
        status,
        checkpoint: status,
        attempts: status === "PENDING" ? 0 : 1,
        pipelineVersion: 4,
        originalBytes: 10,
        optimizedBytes: status === "COMPLETE" ? 5 : 10,
        potentialSavedBytes: status === "COMPLETE" ? 5 : 0,
        updatedAt: "2026-08-11T12:00:00.000Z",
        error: status === "FAILED_FINAL" ? "test failure" : undefined,
      });
    });
    mocks.listMedia.mockResolvedValue(
      mediaIds.map((id) => ({ id, payload: { mimeType: "audio/wav" } })),
    );
    localStorageValues.set("flash-n-flip.audio-optimization.paused.v2", "1");

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();
    const summary = subject.audioOptimizationSummary();

    expect(summary).toMatchObject({
      total: 5,
      complete: 1,
      processed: 4,
      pending: 1,
      keptOriginal: 1,
      unsupported: 1,
      failed: 1,
    });
    expect(
      summary.complete +
        summary.pending +
        summary.keptOriginal +
        summary.unsupported +
        summary.failed,
    ).toBe(summary.total);
  });

  it("repairs old battery-protection and undecodable jobs during hydration", async () => {
    const deferredMediaId = "00000000-0000-4000-8000-000000000123";
    const unsupportedMediaId = "00000000-0000-4000-8000-000000000124";
    const base = {
      status: "FAILED_FINAL",
      checkpoint: "FAILED",
      attempts: 3,
      pipelineVersion: 4,
      originalBytes: 10,
      optimizedBytes: 10,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-11T12:00:00.000Z",
    };
    mocks.jobs.set(deferredMediaId, {
      ...base,
      mediaId: deferredMediaId,
      workerLabel: "iPhone/iPad",
      error: "Audio optimization is paused to protect battery and temperature",
    });
    mocks.jobs.set(unsupportedMediaId, {
      ...base,
      mediaId: unsupportedMediaId,
      workerLabel: "iPhone/iPad",
      error: "UNSUPPORTED: Audio has no decodable audio track",
    });
    mocks.listMedia.mockResolvedValue(
      [deferredMediaId, unsupportedMediaId].map((id) => ({
        id,
        payload: { mimeType: "audio/wav" },
      })),
    );
    localStorageValues.set("flash-n-flip.audio-optimization.paused.v2", "1");

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationSummary()).toMatchObject({
      failed: 0,
      pending: 1,
      deferred: 1,
      unsupported: 1,
      unsupportedReasons: [["FORMAT_OR_DECODE", 1]],
    });
    expect(subject.audioOptimizationJobs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mediaId: deferredMediaId,
          status: "PENDING",
          checkpoint: "DEFERRED_DEVICE_PROTECTION",
          attempts: 0,
        }),
        expect.objectContaining({
          mediaId: unsupportedMediaId,
          status: "UNSUPPORTED",
          checkpoint: "UNSUPPORTED_INPUT",
        }),
      ]),
    );
  });

  it("attributes completed and failed work to the recorded engine instead of the receiving peer", async () => {
    const nativeMediaId = "00000000-0000-4000-8000-000000000120";
    const browserMediaId = "00000000-0000-4000-8000-000000000121";
    const failedMediaId = "00000000-0000-4000-8000-000000000122";
    const base = {
      attempts: 1,
      pipelineVersion: 4,
      originalBytes: 10,
      optimizedBytes: 5,
      potentialSavedBytes: 5,
      updatedAt: "2026-08-11T12:00:00.000Z",
    };
    mocks.jobs.set(nativeMediaId, {
      ...base,
      mediaId: nativeMediaId,
      status: "COMPLETE",
      checkpoint: "RECEIVED_FROM_PEER",
      workerLabel: "Verbundenes Gerät",
      engine: "avfoundation",
    });
    mocks.jobs.set(browserMediaId, {
      ...base,
      mediaId: browserMediaId,
      status: "COMPLETE",
      checkpoint: "RECEIVED_FROM_PEER",
      workerLabel: "Verbundenes Gerät",
      engine: "ffmpegwasm",
    });
    mocks.jobs.set(failedMediaId, {
      ...base,
      mediaId: failedMediaId,
      status: "FAILED_FINAL",
      checkpoint: "FAILED",
      workerLabel: "iPhone/iPad",
      optimizedBytes: 10,
      potentialSavedBytes: 0,
      error: "test failure",
    });
    mocks.listMedia.mockResolvedValue(
      [nativeMediaId, browserMediaId, failedMediaId].map((id) => ({
        id,
        payload: { mimeType: "audio/wav" },
      })),
    );

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationSummary()).toMatchObject({
      contributors: [
        ["APPLE_NATIVE", 1],
        ["BROWSER", 1],
      ],
      failedContributors: [["APPLE_NATIVE", 1]],
      failureReasons: [["UNKNOWN", 1]],
      unclassifiedFailureDetails: [["test failure", 1]],
    });
  });

  it("removes durable jobs whose source audio was deleted with its deck", async () => {
    const retainedMediaId = "00000000-0000-4000-8000-000000000110";
    const deletedMediaId = "00000000-0000-4000-8000-000000000111";
    for (const mediaId of [retainedMediaId, deletedMediaId]) {
      mocks.jobs.set(mediaId, {
        mediaId,
        status: "COMPLETE",
        checkpoint: "COMPARISON_READY",
        attempts: 1,
        pipelineVersion: 4,
        originalBytes: 10,
        optimizedBytes: 5,
        potentialSavedBytes: 5,
        updatedAt: "2026-08-11T12:00:00.000Z",
      });
    }
    mocks.listMedia.mockResolvedValue([
      {
        id: retainedMediaId,
        payload: { mimeType: "audio/wav" },
      },
    ]);
    localStorageValues.set("flash-n-flip.audio-optimization.paused.v2", "1");

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs().map((job) => job.mediaId)).toEqual([
      retainedMediaId,
    ]);
    expect([...mocks.jobs.keys()]).toEqual([retainedMediaId]);
    expect(subject.audioOptimizationSummary()).toMatchObject({
      total: 1,
      complete: 1,
      savedBytes: 5,
    });
  });

  it("removes recursively queued derivative outputs from the durable work list", async () => {
    const sourceMediaId = "00000000-0000-4000-8000-000000000112";
    const derivativeMediaId = "00000000-0000-4000-8000-000000000113";
    for (const mediaId of [sourceMediaId, derivativeMediaId]) {
      mocks.jobs.set(mediaId, {
        mediaId,
        status: "PENDING",
        checkpoint: "DISCOVERED",
        attempts: 0,
        pipelineVersion: 4,
        originalBytes: 0,
        optimizedBytes: 0,
        potentialSavedBytes: 0,
        updatedAt: "2026-08-12T12:00:00.000Z",
      });
    }
    mocks.listMedia.mockResolvedValue([
      {
        id: sourceMediaId,
        payload: {
          fileName: "original.wav",
          mimeType: "audio/wav",
        },
      },
      {
        id: derivativeMediaId,
        payload: {
          fileName: "fnfa2~damaged-old-envelope.m4a",
          mimeType: "audio/mp4",
        },
      },
    ]);
    localStorageValues.set("flash-n-flip.audio-optimization.paused.v2", "1");

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs().map((job) => job.mediaId)).toEqual([
      sourceMediaId,
    ]);
    expect([...mocks.jobs.keys()]).toEqual([sourceMediaId]);
  });

  it("never discovers an internal derivative output as a new source job", async () => {
    const derivativeMediaId = "00000000-0000-4000-8000-000000000114";
    mocks.listMedia.mockResolvedValue([
      {
        id: derivativeMediaId,
        payload: {
          fileName: "fnfa2~damaged-old-envelope.m4a",
          mimeType: "audio/mp4",
        },
      },
    ]);
    const subject = await loadSubject();

    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationSummary()).toMatchObject({ total: 0 });
    expect(mocks.optimizeFile).not.toHaveBeenCalled();
  });

  it("installs a verified derivative and records actually freed bytes", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000101";
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/wav" } },
    ]);
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

  it("uses the bundled browser decoder when iOS cannot decode Goethe audio", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000107";
    mocks.browserAvailable = true;
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/ogg" } },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4, 5, 6])], {
        type: "audio/ogg",
      }),
    );
    mocks.optimizeFile.mockRejectedValue(
      new Error("UNSUPPORTED: Audio has no decodable audio track"),
    );
    mocks.optimizeInBrowser.mockResolvedValue({
      optimized: true,
      mimeType: "audio/mp4",
      originalBytes: 6,
      optimizedBytes: 3,
      bytes: Uint8Array.from([7, 8, 9]),
      engine: "ffmpeg.wasm",
      engineVersion: "0.12.10-v4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });

    subject.enqueueLocalAudioOptimization([mediaId]);
    await waitFor(() => subject.audioOptimizationSummary().complete === 1);

    expect(mocks.optimizeInBrowser).toHaveBeenCalledOnce();
    expect(mocks.installOptimized).toHaveBeenCalledWith(
      expect.objectContaining({
        originalMediaId: mediaId,
        mimeType: "audio/mp4",
        bytes: Uint8Array.from([7, 8, 9]),
        engine: "ffmpeg.wasm",
      }),
    );
  });

  it("retries a previously unsupported native decode through the browser decoder", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000108";
    mocks.browserAvailable = true;
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "UNSUPPORTED",
      checkpoint: "UNSUPPORTED_INPUT",
      attempts: 1,
      pipelineVersion: 4,
      originalBytes: 6,
      optimizedBytes: 6,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-13T10:00:00.000Z",
      error: "Audio has no decodable audio track",
    });
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/ogg" } },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4, 5, 6])], {
        type: "audio/ogg",
      }),
    );
    mocks.optimizeFile.mockRejectedValue(
      new Error("UNSUPPORTED: Audio has no decodable audio track"),
    );
    mocks.optimizeInBrowser.mockResolvedValue({
      optimized: true,
      mimeType: "audio/mp4",
      originalBytes: 6,
      optimizedBytes: 3,
      bytes: Uint8Array.from([7, 8, 9]),
      engine: "ffmpeg.wasm",
      engineVersion: "0.12.10-v4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });
    const subject = await loadSubject();

    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "COMPLETE",
      checkpoint: "COMPARISON_READY",
      attempts: 1,
    });
    expect(mocks.optimizeInBrowser).toHaveBeenCalledOnce();
  });

  it("uses one runner when several resume signals arrive together", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000140";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "PENDING",
      checkpoint: "QUEUED",
      attempts: 0,
      pipelineVersion: 4,
      originalBytes: 0,
      optimizedBytes: 0,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-12T08:00:00.000Z",
    });
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/wav" } },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/wav" }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes: 4,
      optimizedBytes: 4,
      engine: "native-test",
      engineVersion: "4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });
    const subject = await loadSubject();

    await Promise.all([
      subject.startLocalAudioOptimization(),
      subject.startLocalAudioOptimization(),
      subject.startLocalAudioOptimization(),
    ]);

    expect(mocks.optimizeFile).toHaveBeenCalledOnce();
    expect(mocks.cleanupActivatedOriginals).toHaveBeenCalledOnce();
    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "KEPT_ORIGINAL",
      attempts: 1,
    });
  });

  it("distinguishes a recovered local derivative from a peer result", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000141";
    const outputMediaId = "00000000-0000-4000-8000-000000000142";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "PENDING",
      checkpoint: "RESTARTED",
      attempts: 1,
      pipelineVersion: 4,
      originalBytes: 6,
      optimizedBytes: 6,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-12T08:00:00.000Z",
    });
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/wav" } },
      { id: outputMediaId, payload: { mimeType: "audio/mp4" } },
    ]);
    mocks.listDerivatives.mockResolvedValue([
      {
        payload: {
          sourceMediaId: mediaId,
          sourceBytes: 6,
          outputMediaId,
          outputSha256: "a".repeat(64),
          outputBytes: 3,
          createdByDeviceId: "00000000-0000-4000-8000-000000000099",
          engine: "AVFoundation-adaptive-denoise",
        },
      },
    ]);
    mocks.repositoryGetMedia.mockResolvedValue({
      sha256: "a".repeat(64),
      bytes: Uint8Array.from([7, 8, 9]),
    });
    const subject = await loadSubject();

    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "COMPLETE",
      checkpoint: "RECOVERED_LOCAL_RESULT",
      workerLabel: "iPhone/iPad",
      engine: "AVFoundation-adaptive-denoise",
    });
    expect(mocks.optimizeFile).not.toHaveBeenCalled();
  });

  it("restores an interrupted durable job as pending and resumes it", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000102";
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/mpeg" } },
    ]);
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "ENCODING",
      checkpoint: "NATIVE_FILE",
      attempts: 1,
      pipelineVersion: 4,
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
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/mpeg" } },
    ]);
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

  it("reprocesses a completed v2 derivative with the v4 louder denoising pipeline", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000105";
    const outputMediaId = "00000000-0000-4000-8000-000000000106";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "COMPLETE",
      checkpoint: "COMPARISON_READY",
      attempts: 1,
      pipelineVersion: 2,
      originalBytes: 6,
      optimizedBytes: 3,
      potentialSavedBytes: 3,
      updatedAt: "2026-08-11T12:00:00.000Z",
    });
    mocks.listMedia.mockResolvedValue([
      {
        id: mediaId,
        payload: { mimeType: "audio/wav" },
      },
      {
        id: outputMediaId,
        payload: { mimeType: "audio/mp4" },
      },
    ]);
    mocks.listDerivatives.mockResolvedValue([
      {
        payload: {
          sourceMediaId: mediaId,
          outputMediaId,
          pipelineId: "speech-audio-v2",
          pipelineVersion: 2,
        },
      },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4, 5, 6])], {
        type: "audio/wav",
      }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes: 6,
      optimizedBytes: 6,
      engine: "native-test-denoise",
      engineVersion: "4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "KEPT_ORIGINAL",
      checkpoint: "NO_SAFE_SAVING",
      pipelineVersion: 4,
      attempts: 1,
    });
    expect(mocks.optimizeFile).toHaveBeenCalledOnce();
  });

  it("does not delete or replace the original after an engine failure", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000103";
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/wav" } },
    ]);
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

  it("defers battery or thermal protection without counting a failed attempt", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000125";
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/wav" } },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/wav" }),
    );
    mocks.optimizeFile.mockRejectedValue(
      new Error(
        "DEFERRED: Audio optimization is paused to protect battery and temperature",
      ),
    );

    subject.enqueueLocalAudioOptimization([mediaId]);
    await waitFor(
      () =>
        subject.audioOptimizationJobs()[0]?.checkpoint ===
        "DEFERRED_DEVICE_PROTECTION",
    );

    expect(subject.audioOptimizationSummary()).toMatchObject({
      failed: 0,
      pending: 1,
      deferred: 1,
      processed: 0,
      suspensionReason: "THERMAL",
    });
    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "PENDING",
      attempts: 0,
    });
  });

  it("checks device protection after one minute and resumes automatically", async () => {
    vi.useFakeTimers();
    const mediaId = "00000000-0000-4000-8000-000000000126";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "PENDING",
      checkpoint: "QUEUED",
      attempts: 0,
      pipelineVersion: 4,
      originalBytes: 0,
      optimizedBytes: 0,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-12T12:00:00.000Z",
    });
    mocks.listMedia.mockResolvedValue([
      {
        id: mediaId,
        payload: { fileName: "recording.wav", mimeType: "audio/wav" },
      },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/wav" }),
    );
    mocks.optimizeFile
      .mockRejectedValueOnce(
        new Error(
          "DEFERRED_THERMAL: Audio optimization is paused while the device cools down",
        ),
      )
      .mockResolvedValueOnce({
        optimized: false,
        mimeType: "audio/mp4",
        originalBytes: 4,
        optimizedBytes: 4,
        engine: "AVFoundation-adaptive-denoise",
        engineVersion: "4",
        inputMeasurement: measurement,
        outputMeasurement: measurement,
      });
    const subject = await loadSubject();

    await subject.startLocalAudioOptimization();
    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "PENDING",
      checkpoint: "DEFERRED_DEVICE_PROTECTION",
    });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mocks.optimizeFile).toHaveBeenCalledTimes(2);
    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "KEPT_ORIGINAL",
      checkpoint: "NO_SAFE_SAVING",
      attempts: 1,
    });
    expect(subject.audioOptimizationSummary()).toMatchObject({
      processed: 1,
      suspensionReason: undefined,
    });
  });
});
