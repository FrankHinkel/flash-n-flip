import { describe, expect, it } from "vitest";

import {
  audioDerivativeCandidateId,
  audioDerivativeReferenceFileName,
  audioJobBelongsToDevice,
  parseAudioDerivativeReference,
  selectPreferredAudioDerivative,
  type LocalAudioDerivativePayload,
} from "./audio-optimization.js";

const candidate = (
  overrides: Partial<LocalAudioDerivativePayload>,
): LocalAudioDerivativePayload => ({
  sourceMediaId: "00000000-0000-4000-8000-000000000001",
  sourceSha256: "a".repeat(64),
  sourceBytes: 2_000,
  outputMediaId: "00000000-0000-4000-8000-000000000002",
  outputSha256: "b".repeat(64),
  outputMimeType: "audio/mp4",
  outputBytes: 1_000,
  pipelineId: "speech-audio-v3",
  pipelineVersion: 3,
  engine: "test",
  engineVersion: "3",
  createdByDeviceId: "00000000-0000-4000-8000-000000000003",
  input: {
    durationSeconds: 2,
    integratedLufs: -30,
    truePeakDb: -5,
    sampleRate: 44_100,
    channels: 2,
  },
  output: {
    durationSeconds: 2,
    integratedLufs: -18,
    truePeakDb: -2,
    sampleRate: 24_000,
    channels: 1,
  },
  verifiedAt: "2026-08-11T12:00:00.000Z",
  ...overrides,
});

describe("speech audio derivative contract", () => {
  it("creates stable UUIDs from content hashes", () => {
    expect(audioDerivativeCandidateId("a".repeat(64))).toBe(
      audioDerivativeCandidateId("a".repeat(64)),
    );
    expect(audioDerivativeCandidateId("a".repeat(64))).toMatch(
      /^[a-f0-9-]{36}$/,
    );
  });

  it("selects the closest verified loudness before size", () => {
    const smallerButWorse = candidate({
      outputBytes: 500,
      outputSha256: "c".repeat(64),
      output: { ...candidate({}).output, integratedLufs: -19.5 },
    });
    const closer = candidate({ outputBytes: 900 });
    expect(
      selectPreferredAudioDerivative([smallerButWorse, closer])?.outputSha256,
    ).toBe(closer.outputSha256);
  });

  it("round-trips derivative routing through a protocol-compatible media file name", () => {
    const value = candidate({});
    const fileName = audioDerivativeReferenceFileName(value);
    expect(fileName.length).toBeLessThanOrEqual(255);
    expect(
      parseAudioDerivativeReference({
        fileName,
        outputMediaId: value.outputMediaId,
        outputSha256: value.outputSha256,
        outputBytes: value.outputBytes,
        verifiedAt: value.verifiedAt,
      }),
    ).toEqual({
      ...value,
      engine: "test",
      engineVersion: "3",
    });
  });

  it("keeps legacy v2 derivatives identifiable after the denoising upgrade", () => {
    const value = candidate({
      pipelineId: "speech-audio-v2",
      pipelineVersion: 2,
      engineVersion: "2",
    });
    const parsed = parseAudioDerivativeReference({
      fileName: audioDerivativeReferenceFileName(value),
      outputMediaId: value.outputMediaId,
      outputSha256: value.outputSha256,
      outputBytes: value.outputBytes,
      verifiedAt: value.verifiedAt,
    });

    expect(parsed).toMatchObject({
      pipelineId: "speech-audio-v2",
      pipelineVersion: 2,
    });
    expect(selectPreferredAudioDerivative([value])).toBeNull();
  });

  it("partitions a job deterministically between exactly two devices", () => {
    const deviceA = "00000000-0000-4000-8000-000000000001";
    const deviceB = "00000000-0000-4000-8000-000000000002";
    const mediaId = "00000000-0000-4000-8000-000000000010";
    const a = audioJobBelongsToDevice({
      mediaId,
      localDeviceId: deviceA,
      connectedPeerDeviceId: deviceB,
    });
    const b = audioJobBelongsToDevice({
      mediaId,
      localDeviceId: deviceB,
      connectedPeerDeviceId: deviceA,
    });
    expect(Number(a) + Number(b)).toBe(1);
  });
});
