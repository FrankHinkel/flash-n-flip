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

export const maximumTrustedDeviceGroupSize = 16;

export type DevicePairingEdge = {
  deviceAId: string;
  deviceBId: string;
  revokedAt: Date | string | null;
};

export function orderedDevicePair(
  firstDeviceId: string,
  secondDeviceId: string,
): [string, string] {
  if (firstDeviceId === secondDeviceId) {
    throw new Error("A device cannot be paired with itself");
  }
  return firstDeviceId.localeCompare(secondDeviceId) < 0
    ? [firstDeviceId, secondDeviceId]
    : [secondDeviceId, firstDeviceId];
}

function activeDeviceAdjacency(input: {
  activeDeviceIds: readonly string[];
  pairings: readonly DevicePairingEdge[];
}): Map<string, Set<string>> {
  const active = new Set(input.activeDeviceIds);
  const adjacency = new Map<string, Set<string>>();
  for (const pairing of input.pairings) {
    if (
      pairing.revokedAt ||
      !active.has(pairing.deviceAId) ||
      !active.has(pairing.deviceBId)
    ) {
      continue;
    }
    const fromA = adjacency.get(pairing.deviceAId) ?? new Set<string>();
    fromA.add(pairing.deviceBId);
    adjacency.set(pairing.deviceAId, fromA);
    const fromB = adjacency.get(pairing.deviceBId) ?? new Set<string>();
    fromB.add(pairing.deviceAId);
    adjacency.set(pairing.deviceBId, fromB);
  }
  return adjacency;
}

export function trustedDeviceGroupMembers(input: {
  seedDeviceIds: readonly string[];
  activeDeviceIds: readonly string[];
  pairings: readonly DevicePairingEdge[];
}): string[] {
  const active = new Set(input.activeDeviceIds);
  const adjacency = activeDeviceAdjacency(input);
  const members = new Set(
    input.seedDeviceIds.filter((deviceId) => active.has(deviceId)),
  );
  const pending = [...members];
  while (pending.length > 0) {
    const deviceId = pending.shift()!;
    for (const peerDeviceId of adjacency.get(deviceId) ?? []) {
      if (members.has(peerDeviceId)) continue;
      members.add(peerDeviceId);
      pending.push(peerDeviceId);
    }
  }
  if (members.size > maximumTrustedDeviceGroupSize) {
    throw new Error(
      `A trusted device group is limited to ${maximumTrustedDeviceGroupSize} devices`,
    );
  }
  return [...members].sort((left, right) => left.localeCompare(right));
}

export function completeTrustedDeviceGroupPairings(
  deviceIds: readonly string[],
): Array<[string, string]> {
  const devices = [...new Set(deviceIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (devices.length > maximumTrustedDeviceGroupSize) {
    throw new Error(
      `A trusted device group is limited to ${maximumTrustedDeviceGroupSize} devices`,
    );
  }
  const pairs: Array<[string, string]> = [];
  for (let left = 0; left < devices.length; left += 1) {
    for (let right = left + 1; right < devices.length; right += 1) {
      pairs.push([devices[left]!, devices[right]!]);
    }
  }
  return pairs;
}

export function completeExistingTrustedDeviceGroups(input: {
  activeDeviceIds: readonly string[];
  pairings: readonly DevicePairingEdge[];
}): Array<[string, string]> {
  const active = [...new Set(input.activeDeviceIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  const adjacency = activeDeviceAdjacency(input);
  const visited = new Set<string>();
  const pairs: Array<[string, string]> = [];

  for (const deviceId of active) {
    if (visited.has(deviceId) || !adjacency.has(deviceId)) continue;
    const members: string[] = [];
    const pending = [deviceId];
    visited.add(deviceId);
    while (pending.length > 0) {
      const member = pending.shift()!;
      members.push(member);
      for (const peerDeviceId of adjacency.get(member) ?? []) {
        if (visited.has(peerDeviceId)) continue;
        visited.add(peerDeviceId);
        pending.push(peerDeviceId);
      }
    }
    pairs.push(...completeTrustedDeviceGroupPairings(members));
  }
  return pairs;
}

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
