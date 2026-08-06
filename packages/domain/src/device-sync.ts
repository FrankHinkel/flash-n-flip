import { z } from "zod";

export const devicePlatformSchema = z.enum([
  "WEB",
  "APPLE",
  "ANDROID",
  "WINDOWS",
]);
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;

export const deviceCapabilitySchema = z.enum([
  "PAIRING_V1",
  "WEBRTC_V1",
  "DECK_TRANSFER_V1",
  "PEER_SYNC_V1",
  "LAN_DISCOVERY_V1",
]);
export type DeviceCapability = z.infer<typeof deviceCapabilitySchema>;

export const deviceSchema = z.object({
  id: z.uuid(),
  displayName: z.string().trim().min(1).max(80),
  platform: devicePlatformSchema,
  publicKey: z.string().min(32).max(4096),
  capabilities: z.array(deviceCapabilitySchema).max(10),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
});
export type Device = z.infer<typeof deviceSchema>;

export const registerDeviceSchema = deviceSchema.pick({
  id: true,
  displayName: true,
  platform: true,
  publicKey: true,
  capabilities: true,
});
export type RegisterDevice = z.infer<typeof registerDeviceSchema>;

export const updateDeviceSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});
export type UpdateDevice = z.infer<typeof updateDeviceSchema>;

export const pairingSessionStateSchema = z.enum([
  "CREATED",
  "JOINED",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
]);
export type PairingSessionState = z.infer<typeof pairingSessionStateSchema>;

export const pairingSessionSchema = z.object({
  id: z.uuid(),
  initiatorDeviceId: z.uuid(),
  joiningDeviceId: z.uuid().nullable(),
  state: pairingSessionStateSchema,
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
});
export type PairingSession = z.infer<typeof pairingSessionSchema>;

export const createPairingSessionSchema = z.object({
  initiatorDeviceId: z.uuid(),
  initiatorEphemeralPublicKey: z.string().min(32).max(4096),
  initiatorFingerprintProof: z.string().min(32).max(512),
});
export type CreatePairingSession = z.infer<typeof createPairingSessionSchema>;

export const joinPairingSessionSchema = z.object({
  joiningDeviceId: z.uuid(),
  joiningEphemeralPublicKey: z.string().min(32).max(4096),
  joiningFingerprintProof: z.string().min(32).max(512),
});
export type JoinPairingSession = z.infer<typeof joinPairingSessionSchema>;

export const confirmPairingSessionSchema = z.object({
  deviceId: z.uuid(),
  confirmationProof: z.string().min(32).max(512),
});
export type ConfirmPairingSession = z.infer<typeof confirmPairingSessionSchema>;

export const pairingQrPayloadSchema = z.object({
  version: z.literal(1),
  serverOrigin: z.url(),
  sessionId: z.uuid(),
  secret: z.string().min(43).max(128),
  initiatorDeviceId: z.uuid(),
  initiatorEphemeralPublicKey: z.string().min(32).max(4096),
});
export type PairingQrPayload = z.infer<typeof pairingQrPayloadSchema>;

export const pairingSignalTypeSchema = z.enum([
  "OFFER",
  "ANSWER",
  "ICE_CANDIDATE",
  "ICE_COMPLETE",
  "ABORT",
]);

export const pairingSignalSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  senderDeviceId: z.uuid(),
  recipientDeviceId: z.uuid(),
  sequence: z.number().int().positive(),
  type: pairingSignalTypeSchema,
  payload: z.string().max(48 * 1024),
  createdAt: z.string().datetime(),
});
export type PairingSignal = z.infer<typeof pairingSignalSchema>;

export const createPairingSignalSchema = pairingSignalSchema.pick({
  senderDeviceId: true,
  recipientDeviceId: true,
  type: true,
  payload: true,
});
export type CreatePairingSignal = z.infer<typeof createPairingSignalSchema>;

export const peerEntityTypeSchema = z.enum([
  "DECK",
  "NOTE",
  "CARD",
  "MEDIA_REFERENCE",
  "REVIEW",
  "SETTING",
  "VIRTUAL_STUDY_TARGET",
]);

export const peerMutationSchema = z.object({
  mutationId: z.uuid(),
  entityId: z.uuid(),
  entityType: peerEntityTypeSchema,
  operation: z.enum(["UPSERT", "DELETE"]),
  originDeviceId: z.uuid(),
  originSequence: z.number().int().positive(),
  modifiedAt: z.string().datetime(),
  baseVersion: z.number().int().nonnegative().nullable(),
  resultVersion: z.number().int().positive().nullable(),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  payload: z.unknown(),
});
export type PeerMutation = z.infer<typeof peerMutationSchema>;

export const replicaWatermarksSchema = z.record(
  z.uuid(),
  z.number().int().nonnegative(),
);
export type ReplicaWatermarks = z.infer<typeof replicaWatermarksSchema>;

export const transferKindSchema = z.enum([
  "DECK_COPY",
  "DEVICE_BOOTSTRAP",
  "PEER_SYNC",
]);

export const transferMediaSchema = z.object({
  id: z.uuid(),
  mimeType: z.string().min(1).max(120),
  byteSize: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  chunkHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(65_536),
});
export type TransferMedia = z.infer<typeof transferMediaSchema>;

export const peerTransferManifestSchema = z.object({
  version: z.literal(1),
  transferId: z.uuid(),
  kind: transferKindSchema,
  senderDeviceId: z.uuid(),
  rootDeckIds: z.array(z.uuid()).min(1).max(100),
  deckCount: z.number().int().nonnegative(),
  cardCount: z.number().int().nonnegative(),
  noteCount: z.number().int().nonnegative(),
  mediaCount: z.number().int().nonnegative(),
  totalBytes: z.number().int().nonnegative(),
  chunkSize: z
    .number()
    .int()
    .min(16 * 1024)
    .max(1024 * 1024),
  includesLearningProgress: z.boolean(),
  manifestPayloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  media: z.array(transferMediaSchema).max(100_000),
  createdAt: z.string().datetime(),
});
export type PeerTransferManifest = z.infer<typeof peerTransferManifestSchema>;

export const transferStateSchema = z.enum([
  "PREPARING",
  "AWAITING_ACCEPTANCE",
  "CONNECTING",
  "TRANSFERRING",
  "VERIFYING",
  "COMMITTING",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
  "FAILED",
]);
export type TransferState = z.infer<typeof transferStateSchema>;
