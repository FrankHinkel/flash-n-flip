import { z } from "zod";

import { peerMutationSchema, replicaWatermarksSchema } from "./device-sync.js";

export const localPeerProtocolVersion = 12 as const;

export const localPeerHelloSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_HELLO"),
    version: z.literal(localPeerProtocolVersion),
    handshakeId: z.uuid(),
    deviceId: z.uuid(),
    publicKey: z.string().min(32).max(2_048).optional(),
    watermarks: replicaWatermarksSchema,
    libraryEmpty: z.boolean(),
  })
  .strict();

export const localPeerHelloAcknowledgementSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_HELLO_ACK"),
    version: z.literal(localPeerProtocolVersion),
    handshakeId: z.uuid(),
  })
  .strict();

export const localPeerEmptyLibraryCheckpointSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_EMPTY_LIBRARY_CHECKPOINT"),
    version: z.literal(localPeerProtocolVersion),
    acceptedWatermarks: replicaWatermarksSchema,
  })
  .strict();

export const localPeerMutationBatchSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MUTATIONS"),
    version: z.literal(localPeerProtocolVersion),
    mutations: z.array(peerMutationSchema).max(100),
  })
  .strict();

export const localPeerMutationChunkSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MUTATION_CHUNK"),
    version: z.literal(localPeerProtocolVersion),
    mutationId: z.uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    index: z.number().int().nonnegative().max(511),
    chunkCount: z.number().int().positive().max(512),
    dataBase64: z
      .string()
      .min(1)
      .max(48 * 1024)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export const localPeerAcknowledgementSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_ACK"),
    version: z.literal(localPeerProtocolVersion),
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
    version: z.literal(localPeerProtocolVersion),
    media: z.array(localPeerMediaDescriptorSchema).min(1).max(100),
  })
  .strict();

export const localPeerMediaRequestSchema = z
  .object({
    kind: z.literal("LOCAL_SYNC_MEDIA_REQUEST"),
    version: z.literal(localPeerProtocolVersion),
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
    version: z.literal(localPeerProtocolVersion),
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
  localPeerHelloAcknowledgementSchema,
  localPeerEmptyLibraryCheckpointSchema,
  localPeerMutationBatchSchema,
  localPeerMutationChunkSchema,
  localPeerAcknowledgementSchema,
  localPeerMediaInventorySchema,
  localPeerMediaRequestSchema,
  localPeerMediaChunkSchema,
]);
export type LocalPeerMessage = z.infer<typeof localPeerMessageSchema>;
