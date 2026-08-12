import { z } from "zod";

export const speechAudioPipeline = {
  id: "speech-audio-v3",
  version: 3,
  targetLufs: -18,
  lufsTolerance: 2,
  maximumTruePeakDb: -1.5,
  sampleRate: 24_000,
  channels: 1,
  targetBitRate: 40_000,
  maximumInputBytes: 16 * 1024 * 1024,
  maximumDurationSeconds: 30 * 60,
} as const;

const supportedSpeechAudioPipelines = [
  { id: "speech-audio-v2", version: 2 },
  { id: speechAudioPipeline.id, version: speechAudioPipeline.version },
] as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const instantSchema = z.string().datetime();

export const audioQualityMeasurementSchema = z
  .object({
    durationSeconds: z
      .number()
      .finite()
      .positive()
      .max(30 * 60),
    integratedLufs: z.number().finite().min(-100).max(10),
    truePeakDb: z.number().finite().min(-100).max(10),
    sampleRate: z.number().int().positive().max(384_000),
    channels: z.number().int().positive().max(32),
  })
  .strict();
export type AudioQualityMeasurement = z.infer<
  typeof audioQualityMeasurementSchema
>;

export const localAudioDerivativePayloadSchema = z
  .object({
    sourceMediaId: z.uuid(),
    sourceSha256: sha256Schema,
    sourceBytes: z
      .number()
      .int()
      .positive()
      .max(512 * 1024 * 1024),
    outputMediaId: z.uuid(),
    outputSha256: sha256Schema,
    outputMimeType: z.literal("audio/mp4"),
    outputBytes: z
      .number()
      .int()
      .positive()
      .max(512 * 1024 * 1024),
    pipelineId: z.enum(["speech-audio-v2", speechAudioPipeline.id]),
    pipelineVersion: z.union([z.literal(2), z.literal(speechAudioPipeline.version)]),
    engine: z.string().trim().min(1).max(120),
    engineVersion: z.string().trim().min(1).max(80),
    createdByDeviceId: z.uuid(),
    input: audioQualityMeasurementSchema,
    output: audioQualityMeasurementSchema,
    verifiedAt: instantSchema,
  })
  .strict()
  .refine(
    (value) =>
      supportedSpeechAudioPipelines.some(
        (pipeline) =>
          pipeline.id === value.pipelineId &&
          pipeline.version === value.pipelineVersion,
      ),
    {
      message: "Audio pipeline id and version do not match",
      path: ["pipelineVersion"],
    },
  )
  .refine((value) => value.outputBytes < value.sourceBytes, {
    message: "An activated audio derivative must be smaller than its source",
    path: ["outputBytes"],
  });
export type LocalAudioDerivativePayload = z.infer<
  typeof localAudioDerivativePayloadSchema
>;

const compactUuid = (value: string): string =>
  z.uuid().parse(value).replaceAll("-", "");
const expandUuid = (value: string): string =>
  z
    .uuid()
    .parse(
      `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`,
    );
const metric = (value: number): string => Math.round(value * 100).toString(10);
const safeEngineToken = (value: string): string => {
  const token = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 12);
  return token || "local";
};
const routedEngineVersionToken = (
  value: string,
  pipelineVersion: 2 | 3,
): string => {
  const token = safeEngineToken(value);
  if (
    pipelineVersion === 2 ||
    token === "3" ||
    token.endsWith("-v3")
  ) {
    return token;
  }
  return `${token.slice(0, 9)}-v3`;
};

/**
 * Stores derivative routing metadata inside an ordinary MEDIA_REFERENCE name.
 * Existing protocol-v2 peers can therefore replicate it without learning a new
 * entity type; current clients decode the strictly validated fnfa2 envelope.
 * The engine-version token identifies the quality generation without making
 * older sync clients mistake the derivative for a new original.
 */
export const audioDerivativeReferenceFileName = (
  payload: LocalAudioDerivativePayload,
): string => {
  const value = localAudioDerivativePayloadSchema.parse(payload);
  const fields = [
    "fnfa2",
    compactUuid(value.sourceMediaId),
    value.sourceSha256,
    value.sourceBytes.toString(10),
    compactUuid(value.createdByDeviceId),
    Math.round(value.input.durationSeconds * 1_000).toString(10),
    metric(value.input.integratedLufs),
    metric(value.input.truePeakDb),
    value.input.sampleRate.toString(10),
    value.input.channels.toString(10),
    Math.round(value.output.durationSeconds * 1_000).toString(10),
    metric(value.output.integratedLufs),
    metric(value.output.truePeakDb),
    safeEngineToken(value.engine),
    routedEngineVersionToken(value.engineVersion, value.pipelineVersion),
  ];
  return `${fields.join("~")}.m4a`;
};

export const isAudioDerivativeReferenceFileName = (value: string): boolean =>
  /^fnfa[0-9]+~/.test(value);

export const parseAudioDerivativeReference = (input: {
  fileName: string;
  outputMediaId: string;
  outputSha256: string;
  outputBytes: number;
  verifiedAt: string;
}): LocalAudioDerivativePayload | null => {
  const match =
    /^fnfa2~([a-f0-9]{32})~([a-f0-9]{64})~([0-9]+)~([a-f0-9]{32})~([0-9]+)~(-?[0-9]+)~(-?[0-9]+)~([0-9]+)~([0-9]+)~([0-9]+)~(-?[0-9]+)~(-?[0-9]+)~([a-z0-9-]+)~([a-z0-9-]+)\.m4a$/.exec(
      input.fileName,
    );
  if (!match) return null;
  const engineVersion = match[14]!;
  const pipelineVersion =
    engineVersion === "3" || engineVersion.endsWith("-v3") ? 3 : 2;
  const parsed = localAudioDerivativePayloadSchema.safeParse({
    sourceMediaId: expandUuid(match[1]!),
    sourceSha256: match[2],
    sourceBytes: Number.parseInt(match[3]!, 10),
    outputMediaId: input.outputMediaId,
    outputSha256: input.outputSha256,
    outputMimeType: "audio/mp4",
    outputBytes: input.outputBytes,
    pipelineId: `speech-audio-v${pipelineVersion}`,
    pipelineVersion,
    engine: match[13],
    engineVersion,
    createdByDeviceId: expandUuid(match[4]!),
    input: {
      durationSeconds: Number.parseInt(match[5]!, 10) / 1_000,
      integratedLufs: Number.parseInt(match[6]!, 10) / 100,
      truePeakDb: Number.parseInt(match[7]!, 10) / 100,
      sampleRate: Number.parseInt(match[8]!, 10),
      channels: Number.parseInt(match[9]!, 10),
    },
    output: {
      durationSeconds: Number.parseInt(match[10]!, 10) / 1_000,
      integratedLufs: Number.parseInt(match[11]!, 10) / 100,
      truePeakDb: Number.parseInt(match[12]!, 10) / 100,
      sampleRate: speechAudioPipeline.sampleRate,
      channels: speechAudioPipeline.channels,
    },
    verifiedAt: input.verifiedAt,
  });
  return parsed.success ? parsed.data : null;
};

export const audioOptimizationJobStatusSchema = z.enum([
  "PENDING",
  "ANALYZING",
  "PROCESSING",
  "ENCODING",
  "VERIFYING",
  "COMPLETE",
  "KEPT_ORIGINAL",
  "UNSUPPORTED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
]);

export const audioOptimizationJobSchema = z
  .object({
    mediaId: z.uuid(),
    sourceSha256: sha256Schema.optional(),
    status: audioOptimizationJobStatusSchema,
    checkpoint: z.string().trim().min(1).max(80),
    attempts: z.number().int().nonnegative().max(20),
    originalBytes: z.number().int().nonnegative(),
    optimizedBytes: z.number().int().nonnegative(),
    potentialSavedBytes: z.number().int().nonnegative(),
    workerDeviceId: z.uuid().optional(),
    workerLabel: z.string().trim().min(1).max(80).optional(),
    engine: z.string().trim().min(1).max(120).optional(),
    pipelineVersion: z.number().int().positive().max(100).optional(),
    updatedAt: instantSchema,
    error: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
export type AudioOptimizationJob = z.infer<typeof audioOptimizationJobSchema>;

export const audioDerivativeCandidateId = (sha256: string): string => {
  const normalized = sha256Schema.parse(sha256).slice(0, 32).split("");
  normalized[12] = "4";
  normalized[16] = (
    (Number.parseInt(normalized[16]!, 16) & 0x3) |
    0x8
  ).toString(16);
  const value = normalized.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

export const audioDerivativeQualityScore = (
  candidate: LocalAudioDerivativePayload,
): readonly [number, number, string] => [
  Math.abs(candidate.output.integratedLufs - speechAudioPipeline.targetLufs),
  candidate.outputBytes,
  candidate.outputSha256,
];

export const selectPreferredAudioDerivative = (
  candidates: readonly LocalAudioDerivativePayload[],
): LocalAudioDerivativePayload | null =>
  [...candidates]
    .filter(
      (candidate) =>
        candidate.pipelineId === speechAudioPipeline.id &&
        candidate.pipelineVersion === speechAudioPipeline.version &&
        Math.abs(
          candidate.output.integratedLufs - speechAudioPipeline.targetLufs,
        ) <= speechAudioPipeline.lufsTolerance &&
        candidate.output.truePeakDb <= speechAudioPipeline.maximumTruePeakDb,
    )
    .sort((left, right) => {
      const a = audioDerivativeQualityScore(left);
      const b = audioDerivativeQualityScore(right);
      return a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]);
    })[0] ?? null;

export const audioJobBelongsToDevice = (input: {
  mediaId: string;
  localDeviceId: string;
  connectedPeerDeviceId?: string | null;
}): boolean => {
  if (!input.connectedPeerDeviceId) return true;
  const devices = [input.localDeviceId, input.connectedPeerDeviceId].sort();
  let hash = 2166136261;
  for (const character of input.mediaId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return devices[(hash >>> 0) % devices.length] === input.localDeviceId;
};
