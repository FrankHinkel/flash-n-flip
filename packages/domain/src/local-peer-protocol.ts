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

export const localPeerMessageSchema = z.discriminatedUnion("kind", [
  localPeerHelloSchema,
  localPeerMutationBatchSchema,
  localPeerAcknowledgementSchema,
]);
export type LocalPeerMessage = z.infer<typeof localPeerMessageSchema>;
