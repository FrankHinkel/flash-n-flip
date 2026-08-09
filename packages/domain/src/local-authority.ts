import { z } from "zod";

import {
  peerEntityTypeSchema,
  peerMutationSchema,
  replicaWatermarksSchema,
} from "./device-sync.js";

export const localAuthoritySchemaVersion = 1 as const;

export const localAuthorityMetadataSchema = z.object({
  deviceId: z.uuid(),
  nextOriginSequence: z.number().int().positive(),
});
export type LocalAuthorityMetadata = z.infer<
  typeof localAuthorityMetadataSchema
>;

export const localMaterializedEntitySchema = z
  .object({
    winningMutation: peerMutationSchema,
    currentVersion: z.number().int().positive().nullable(),
  })
  .superRefine((value, context) => {
    const mutation = value.winningMutation;
    if (mutation.entityType === "REVIEW") {
      if (mutation.operation !== "UPSERT" || value.currentVersion !== null) {
        context.addIssue({
          code: "custom",
          message: "Review events are append-only and have no mutable version",
        });
      }
      return;
    }
    if (
      mutation.resultVersion === null ||
      mutation.resultVersion !== value.currentVersion
    ) {
      context.addIssue({
        code: "custom",
        message: "Mutable entities must expose their winning result version",
      });
    }
  });
export type LocalMaterializedEntity = z.infer<
  typeof localMaterializedEntitySchema
>;

export const localMutationInputSchema = z.object({
  entityId: z.uuid(),
  entityType: peerEntityTypeSchema,
  operation: z.enum(["UPSERT", "DELETE"]),
  baseVersion: z.number().int().nonnegative().nullable(),
  payload: z.unknown(),
  modifiedAt: z.string().datetime().optional(),
});
export type LocalMutationInput = z.infer<typeof localMutationInputSchema>;

export const localAuthorityExportPayloadSchema = z.object({
  schemaVersion: z.literal(localAuthoritySchemaVersion),
  exportedAt: z.string().datetime(),
  source: localAuthorityMetadataSchema,
  entities: z.array(localMaterializedEntitySchema),
  mutationJournal: z.array(peerMutationSchema),
  outboxMutationIds: z.array(z.uuid()),
  replicaWatermarks: replicaWatermarksSchema,
});
export type LocalAuthorityExportPayload = z.infer<
  typeof localAuthorityExportPayloadSchema
>;

export const localAuthorityExportEnvelopeSchema = z.object({
  format: z.literal("flash-n-flip-local-authority"),
  version: z.literal(1),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  payload: localAuthorityExportPayloadSchema,
});
export type LocalAuthorityExportEnvelope = z.infer<
  typeof localAuthorityExportEnvelopeSchema
>;
