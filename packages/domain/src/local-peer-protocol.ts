import { z } from "zod";

import { peerMutationSchema, replicaWatermarksSchema } from "./device-sync.js";

export const localPeerHelloSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_HELLO"),
    version: z.literal(1),
    deviceId: z.uuid(),
    watermarks: replicaWatermarksSchema,
  })
  .strict();

export const localPeerMutationBatchSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MUTATIONS"),
    version: z.literal(1),
    mutations: z.array(peerMutationSchema).max(100),
  })
  .strict();

export const localPeerAcknowledgementSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_ACK"),
    version: z.literal(1),
    mutationIds: z.array(z.uuid()).max(100),
  })
  .strict();

const localPeerMediaDescriptorSchema = z
  .object({
    mediaId: z.uuid(),
    mimeType: z.string().trim().min(1).max(120),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(512 * 1024 * 1024),
    chunkCount: z.number().int().positive().max(65_536),
  })
  .strict();

export const localPeerMediaInventorySchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MEDIA_INVENTORY"),
    version: z.literal(1),
    media: z.array(localPeerMediaDescriptorSchema).min(1).max(100),
  })
  .strict();

export const localPeerMediaRequestSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MEDIA_REQUEST"),
    version: z.literal(1),
    mediaId: z.uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    indices: z
      .array(z.number().int().nonnegative().max(65_535))
      .min(1)
      .max(256),
  })
  .strict();

export const localPeerMediaChunkSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MEDIA_CHUNK"),
    version: z.literal(1),
    mediaId: z.uuid(),
    mimeType: z.string().trim().min(1).max(120),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(512 * 1024 * 1024),
    index: z.number().int().nonnegative().max(65_535),
    chunkCount: z.number().int().positive().max(65_536),
    dataBase64: z
      .string()
      .min(1)
      .max(48 * 1024)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export const localPeerMessageSchema = z.discriminatedUnion("kind", [
  localPeerHelloSchema,
  localPeerMutationBatchSchema,
  localPeerAcknowledgementSchema,
  localPeerMediaInventorySchema,
  localPeerMediaRequestSchema,
  localPeerMediaChunkSchema,
]);
export type LocalPeerMessage = z.infer<typeof localPeerMessageSchema>;
