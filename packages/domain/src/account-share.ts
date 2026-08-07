import { z } from "zod";

import { pairingSignalTypeSchema } from "./device-sync.js";

export const accountShareSessionStateSchema = z.enum([
  "CREATED",
  "CLAIMED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
]);

export type AccountShareSessionState = z.infer<
  typeof accountShareSessionStateSchema
>;

export const createAccountShareSessionSchema = z.object({
  id: z.uuid(),
  senderDeviceId: z.uuid(),
  secretHash: z.string().regex(/^[a-f0-9]{64}$/),
  senderEphemeralPublicKey: z.string().min(32).max(4096),
  senderFingerprintProof: z.string().min(32).max(256),
});

export type CreateAccountShareSession = z.infer<
  typeof createAccountShareSessionSchema
>;

export const joinAccountShareSessionSchema = z.object({
  recipientDeviceId: z.uuid(),
  secret: z.string().min(43).max(128),
  recipientEphemeralPublicKey: z.string().min(32).max(4096),
  recipientFingerprintProof: z.string().min(32).max(256),
});

export type JoinAccountShareSession = z.infer<
  typeof joinAccountShareSessionSchema
>;

export const confirmAccountShareSessionSchema = z.object({
  senderDeviceId: z.uuid(),
});

export const completeAccountShareSessionSchema = z.object({
  recipientDeviceId: z.uuid(),
});

export const cancelAccountShareSessionSchema = z.object({
  deviceId: z.uuid(),
});

export const accountShareQrPayloadSchema = z.object({
  version: z.literal(1),
  serverOrigin: z.url(),
  sessionId: z.uuid(),
  secret: z.string().min(43).max(128),
  senderDeviceId: z.uuid(),
  senderEphemeralPublicKey: z.string().min(32).max(4096),
});

export type AccountShareQrPayload = z.infer<typeof accountShareQrPayloadSchema>;

export const accountShareSessionSchema = z.object({
  id: z.uuid(),
  senderDeviceId: z.uuid(),
  recipientDeviceId: z.uuid().nullable(),
  state: accountShareSessionStateSchema,
  senderDisplayName: z.string().min(1).max(100),
  recipientDisplayName: z.string().min(1).max(100).nullable(),
  senderDeviceName: z.string().min(1).max(100),
  recipientDeviceName: z.string().min(1).max(100).nullable(),
  senderEphemeralPublicKey: z.string().min(32).max(4096),
  senderFingerprintProof: z.string().min(32).max(256),
  recipientEphemeralPublicKey: z.string().min(32).max(4096).nullable(),
  recipientFingerprintProof: z.string().min(32).max(256).nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  consumedAt: z.string().datetime().nullable(),
});

export type AccountShareSession = z.infer<typeof accountShareSessionSchema>;

export const createAccountShareSignalSchema = z.object({
  senderDeviceId: z.uuid(),
  recipientDeviceId: z.uuid(),
  type: pairingSignalTypeSchema,
  payload: z.string().max(48 * 1024),
});

export type CreateAccountShareSignal = z.infer<
  typeof createAccountShareSignalSchema
>;
