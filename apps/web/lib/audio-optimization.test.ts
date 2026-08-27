import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jobs: new Map<string, unknown>(),
  getMedia: vi.fn(),
  installOptimized: vi.fn(),
  listMedia: vi.fn().mockResolvedValue([]),
  listDerivatives: vi.fn().mockResolvedValue([]),
  repositoryGetMedia: vi.fn().mockResolvedValue(null),
  cleanupActivatedOriginals: vi.fn().mockResolvedValue(0),
  localDueCards: vi.fn().mockResolvedValue([]),
  begin: vi.fn(),
  appendInput: vi.fn(),
  optimizeFile: vi.fn(),
  readOutput: vi.fn(),
  cleanup: vi.fn(),
  getProtectionState: vi.fn(),
  protectionListener: undefined as
    | ((state: {
        reason: "NONE" | "BATTERY" | "THERMAL";
        batteryLevel: number;
        batteryState: "UNKNOWN" | "UNPLUGGED" | "CHARGING" | "FULL";
        lowPowerModeEnabled: boolean;
        thermalState: number;
      }) => void)
    | undefined,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    begin: mocks.begin,
    appendInput: mocks.appendInput,
    optimizeFile: mocks.optimizeFile,
    readOutput: mocks.readOutput,
    cleanup: mocks.cleanup,
    getProtectionState: mocks.getProtectionState,
    addListener: vi.fn(
      (
        _eventName: string,
        listener: NonNullable<typeof mocks.protectionListener>,
      ) => {
        mocks.protectionListener = listener;
        return Promise.resolve({
          remove: vi.fn().mockResolvedValue(undefined),
        });
      },
    ),
  }),
}));

vi.mock(
  "@flashcards/direct-connect-webstack/audio-optimization-storage",
  () => ({
    createLocalAudioOptimizationStorage: () => ({
      list: async () => [...mocks.jobs.values()],
      put: async (job: { mediaId: string }) => mocks.jobs.set(job.mediaId, job),
      delete: async (mediaId: string) => mocks.jobs.delete(mediaId),
      deleteMany: async (mediaIds: readonly string[]) =>
        mediaIds.forEach((mediaId) => mocks.jobs.delete(mediaId)),
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

vi.mock("./local-product-repository", () => ({
  getLocalProductOriginalMedia: mocks.getMedia,
  installOptimizedLocalAudio: mocks.installOptimized,
  localDueCards: mocks.localDueCards,
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
  mocks.localDueCards.mockReset().mockResolvedValue([]);
  mocks.begin.mockReset().mockResolvedValue(undefined);
  mocks.appendInput
    .mockReset()
    .mockResolvedValue({ receivedBytes: 6, totalBytes: 6 });
  mocks.optimizeFile.mockReset();
  mocks.readOutput.mockReset();
  mocks.cleanup.mockReset().mockResolvedValue(undefined);
  mocks.getProtectionState.mockReset().mockResolvedValue({
    reason: "NONE",
    batteryLevel: 0.8,
    batteryState: "UNPLUGGED",
    lowPowerModeEnabled: false,
    thermalState: 0,
  });
  mocks.protectionListener = undefined;
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
  it("removes deleted-deck audio jobs when the deck inventory changes", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000200";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "COMPLETE",
      checkpoint: "COMPARISON_READY",
      attempts: 1,
      pipelineVersion: 4,
      originalBytes: 10,
      optimizedBytes: 5,
      potentialSavedBytes: 5,
      updatedAt: "2026-08-17T12:00:00.000Z",
    });
    mocks.listMedia.mockResolvedValue([
      {
        id: mediaId,
        payload: { fileName: "recording.mp3", mimeType: "audio/mpeg" },
      },
    ]);
    const subject = await loadSubject();
    await subject.reconcileAudioOptimizationInventory();
    expect(subject.audioOptimizationSummary().total).toBe(1);

    mocks.listMedia.mockResolvedValue([]);
    const inventoryChanged = new Event("flash-n-flip:decks-changed");
    Object.assign(inventoryChanged, { detail: { source: "permanent-delete" } });
    window.dispatchEvent(inventoryChanged);

    await waitFor(() => subject.audioOptimizationSummary().total === 0);
    expect(mocks.jobs.has(mediaId)).toBe(false);
  });

  it("reports the four durable card-audio optimization states", async () => {
    const currentMediaId = "00000000-0000-4000-8000-000000000201";
    const outdatedMediaId = "00000000-0000-4000-8000-000000000202";
    const keptMediaId = "00000000-0000-4000-8000-000000000203";
    const untouchedMediaId = "00000000-0000-4000-8000-000000000204";
    const currentOutputId = "00000000-0000-4000-8000-000000000211";
    const outdatedOutputId = "00000000-0000-4000-8000-000000000212";
    const outputSha256 = "a".repeat(64);
    const derivative = (
      sourceMediaId: string,
      outputMediaId: string,
      pipelineVersion: 3 | 4,
    ) => ({
      id: outputMediaId,
      version: 1,
      payload: {
        sourceMediaId,
        sourceSha256: "b".repeat(64),
        sourceBytes: 10,
        outputMediaId,
        outputSha256,
        outputMimeType: "audio/mp4" as const,
        outputBytes: 5,
        pipelineId:
          pipelineVersion === 4
            ? ("speech-audio-v4" as const)
            : ("speech-audio-v3" as const),
        pipelineVersion,
        engine: "test",
        engineVersion: String(pipelineVersion),
        createdByDeviceId: "00000000-0000-4000-8000-000000000099",
        input: measurement,
        output: measurement,
        verifiedAt: "2026-08-17T12:00:00.000Z",
      },
    });

    mocks.jobs.set(keptMediaId, {
      mediaId: keptMediaId,
      status: "KEPT_ORIGINAL",
      checkpoint: "NO_SAFE_SAVING",
      attempts: 1,
      pipelineVersion: 4,
      originalBytes: 10,
      optimizedBytes: 10,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-17T12:00:00.000Z",
    });
    mocks.listMedia.mockResolvedValue(
      [currentMediaId, outdatedMediaId, keptMediaId, untouchedMediaId].map(
        (id) => ({
          id,
          payload: { fileName: `${id}.mp3`, mimeType: "audio/mpeg" },
        }),
      ),
    );
    mocks.listDerivatives.mockImplementation(async (mediaId?: string) => {
      if (mediaId === currentMediaId)
        return [derivative(currentMediaId, currentOutputId, 4)];
      if (mediaId === outdatedMediaId)
        return [derivative(outdatedMediaId, outdatedOutputId, 3)];
      return [];
    });
    mocks.repositoryGetMedia.mockImplementation(async (mediaId: string) =>
      mediaId === currentOutputId || mediaId === outdatedOutputId
        ? {
            sha256: outputSha256,
            bytes: Uint8Array.from([1, 2, 3, 4, 5]),
          }
        : null,
    );

    const subject = await loadSubject();

    await expect(
      subject.cardAudioOptimizationStatus(currentMediaId),
    ).resolves.toBe("CURRENT");
    await expect(
      subject.cardAudioOptimizationStatus(outdatedMediaId),
    ).resolves.toBe("OUTDATED");
    await expect(
      subject.cardAudioOptimizationStatus(keptMediaId),
    ).resolves.toBe("KEPT_ORIGINAL");
    await expect(
      subject.cardAudioOptimizationStatus(untouchedMediaId),
    ).resolves.toBe("NOT_OPTIMIZED");
  });

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

  it("transfers native audio in 512 KiB chunks", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000115";
    const originalBytes = 512 * 1024 + 1;
    mocks.listMedia.mockResolvedValue([
      { id: mediaId, payload: { mimeType: "audio/wav" } },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([new Uint8Array(originalBytes)], { type: "audio/wav" }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes,
      optimizedBytes: originalBytes,
      engine: "native-test",
      engineVersion: "4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });

    subject.enqueueLocalAudioOptimization([mediaId]);
    await waitFor(() => subject.audioOptimizationSummary().processed === 1);

    expect(mocks.appendInput).toHaveBeenCalledTimes(2);
    expect(atob(mocks.appendInput.mock.calls[0]![0].dataBase64).length).toBe(
      512 * 1024,
    );
    expect(atob(mocks.appendInput.mock.calls[1]![0].dataBase64).length).toBe(1);
  });

  it("processes audio referenced by today's plan before the backlog", async () => {
    const backlogFirst = "00000000-0000-4000-8000-000000000116";
    const today = "00000000-0000-4000-8000-000000000117";
    const backlogLast = "00000000-0000-4000-8000-000000000118";
    const mediaIds = [backlogFirst, today, backlogLast];
    mocks.listMedia.mockResolvedValue(
      mediaIds.map((id) => ({ id, payload: { mimeType: "audio/wav" } })),
    );
    mocks.localDueCards.mockResolvedValue([
      {
        card: {
          front: {
            blocks: [{ type: "audio", mediaId: today, label: "Today" }],
          },
          back: { blocks: [] },
          translations: {},
        },
      },
    ]);
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3])], { type: "audio/wav" }),
    );
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes: 3,
      optimizedBytes: 3,
      engine: "native-test",
      engineVersion: "4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });

    const subject = await loadSubject();
    await subject.startLocalAudioOptimization();

    expect(mocks.localDueCards).toHaveBeenCalledWith(undefined, false, true);
    expect(mocks.getMedia.mock.calls.map(([mediaId]) => mediaId)).toEqual([
      today,
      backlogFirst,
      backlogLast,
    ]);
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
      timings: {
        analysisMs: 11,
        processingMs: 22,
        verificationMs: 33,
        totalNativeMs: 66,
      },
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
    expect(subject.latestNativeAudioOptimizationPerformance()).toMatchObject({
      analysisMs: 11,
      processingMs: 22,
      verificationMs: 33,
      totalNativeMs: 66,
      transferInMs: expect.any(Number),
      transferOutMs: expect.any(Number),
      totalMs: expect.any(Number),
    });
  });

  it("keeps the original when Apple cannot decode an audio file", async () => {
    const subject = await loadSubject();
    const mediaId = "00000000-0000-4000-8000-000000000107";
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

    subject.enqueueLocalAudioOptimization([mediaId]);
    await waitFor(() => subject.audioOptimizationSummary().unsupported === 1);

    expect(mocks.installOptimized).not.toHaveBeenCalled();
    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "UNSUPPORTED",
      checkpoint: "UNSUPPORTED_INPUT",
      originalBytes: 6,
      optimizedBytes: 6,
    });
  });

  it("does not retry a previously unsupported native decode", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000108";
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
    const subject = await loadSubject();

    await subject.startLocalAudioOptimization();

    expect(subject.audioOptimizationJobs()[0]).toMatchObject({
      status: "UNSUPPORTED",
      checkpoint: "UNSUPPORTED_INPUT",
      attempts: 1,
    });
    expect(mocks.optimizeFile).not.toHaveBeenCalled();
    expect(mocks.installOptimized).not.toHaveBeenCalled();
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

  it("never reports a stale device suspension while the runner is active", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000127";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "PENDING",
      checkpoint: "DEFERRED_DEVICE_PROTECTION",
      attempts: 0,
      pipelineVersion: 4,
      originalBytes: 4,
      optimizedBytes: 4,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-17T08:00:00.000Z",
      error: "Audio optimization is paused while the device cools down",
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
    mocks.optimizeFile.mockResolvedValue({
      optimized: false,
      mimeType: "audio/mp4",
      originalBytes: 4,
      optimizedBytes: 4,
      engine: "AVFoundation-adaptive-denoise",
      engineVersion: "4",
      inputMeasurement: measurement,
      outputMeasurement: measurement,
    });
    let releaseCleanup: ((value: number) => void) | undefined;
    mocks.cleanupActivatedOriginals.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          releaseCleanup = resolve;
        }),
    );
    const subject = await loadSubject();

    const run = subject.startLocalAudioOptimization();
    await waitFor(() => releaseCleanup !== undefined);

    expect(subject.audioOptimizationSummary()).toMatchObject({
      running: true,
      suspensionReason: undefined,
    });

    releaseCleanup!(0);
    await run;
    expect(subject.audioOptimizationSummary()).toMatchObject({
      running: false,
      suspensionReason: undefined,
    });
  });

  it("resumes immediately when native battery protection ends", async () => {
    const mediaId = "00000000-0000-4000-8000-000000000128";
    mocks.jobs.set(mediaId, {
      mediaId,
      status: "PENDING",
      checkpoint: "QUEUED",
      attempts: 0,
      pipelineVersion: 4,
      originalBytes: 0,
      optimizedBytes: 0,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-17T12:00:00.000Z",
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
    mocks.getProtectionState.mockResolvedValue({
      reason: "BATTERY",
      batteryLevel: 0.59,
      batteryState: "UNPLUGGED",
      lowPowerModeEnabled: false,
      thermalState: 0,
    });
    mocks.begin
      .mockRejectedValueOnce(
        new Error(
          "DEFERRED_BATTERY: Audio optimization is paused to protect the battery",
        ),
      )
      .mockResolvedValue(undefined);
    mocks.optimizeFile.mockResolvedValue({
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
    expect(subject.audioOptimizationSummary()).toMatchObject({
      pending: 1,
      running: false,
      suspensionReason: "BATTERY",
    });

    mocks.protectionListener?.({
      reason: "NONE",
      batteryLevel: 0.59,
      batteryState: "CHARGING",
      lowPowerModeEnabled: false,
      thermalState: 0,
    });
    await waitFor(() => subject.audioOptimizationSummary().processed === 1);

    expect(mocks.optimizeFile).toHaveBeenCalledTimes(1);
    expect(subject.audioOptimizationSummary()).toMatchObject({
      pending: 0,
      suspensionReason: undefined,
    });
  });

  it("processes local audio jobs strictly one after another", async () => {
    const mediaIds = [
      "00000000-0000-4000-8000-000000000129",
      "00000000-0000-4000-8000-000000000130",
    ];
    for (const mediaId of mediaIds) {
      mocks.jobs.set(mediaId, {
        mediaId,
        status: "PENDING",
        checkpoint: "QUEUED",
        attempts: 0,
        pipelineVersion: 4,
        originalBytes: 0,
        optimizedBytes: 0,
        potentialSavedBytes: 0,
        updatedAt: "2026-08-17T12:00:00.000Z",
      });
    }
    mocks.listMedia.mockResolvedValue(
      mediaIds.map((id) => ({
        id,
        payload: { fileName: `${id}.wav`, mimeType: "audio/wav" },
      })),
    );
    mocks.getMedia.mockResolvedValue(
      new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "audio/wav" }),
    );
    let releaseFirst: (() => void) | undefined;
    mocks.optimizeFile
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () =>
              resolve({
                optimized: false,
                mimeType: "audio/mp4",
                originalBytes: 4,
                optimizedBytes: 4,
                engine: "AVFoundation-adaptive-denoise",
                engineVersion: "4",
                inputMeasurement: measurement,
                outputMeasurement: measurement,
              });
          }),
      )
      .mockResolvedValue({
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

    const firstRun = subject.startLocalAudioOptimization();
    const duplicateStart = subject.startLocalAudioOptimization();
    expect(duplicateStart).toBe(firstRun);
    await waitFor(() => releaseFirst !== undefined);
    expect(mocks.optimizeFile).toHaveBeenCalledTimes(1);

    releaseFirst!();
    await firstRun;

    expect(mocks.optimizeFile).toHaveBeenCalledTimes(2);
    expect(mocks.listDerivatives).toHaveBeenCalledOnce();
    expect(subject.audioOptimizationSummary()).toMatchObject({
      pending: 0,
      processed: 2,
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
