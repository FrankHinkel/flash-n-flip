import { z } from "zod";

import { localReviewPayloadSchema } from "./local-app-data.js";

export const cloudLibraryProtocolVersion = 1 as const;

export const cloudLibraryIdentitySchema = z
  .object({
    libraryId: z.uuid(),
    libraryGeneration: z.uuid(),
  })
  .strict();

export const cloudProgressScopeSchema = cloudLibraryIdentitySchema
  .extend({
    deckId: z.uuid(),
    deckGeneration: z.uuid(),
    progressGeneration: z.uuid(),
  })
  .strict();

export const cloudDeckControlSchema = cloudProgressScopeSchema
  .extend({
    protocolVersion: z.literal(cloudLibraryProtocolVersion),
    deleted: z.boolean(),
  })
  .strict();

export const cloudReviewEventSchema = cloudProgressScopeSchema
  .extend({
    protocolVersion: z.literal(cloudLibraryProtocolVersion),
    review: localReviewPayloadSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.deckId !== value.review.deckId) {
      context.addIssue({
        code: "custom",
        message: "Review deck does not match its scope",
      });
    }
    if (value.review.after.lastReview !== value.review.reviewedAt) {
      context.addIssue({
        code: "custom",
        message: "Review state does not match its review time",
      });
    }
  });

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const cloudChunkDescriptorSchema = z
  .object({
    index: z.number().int().nonnegative(),
    sha256: digestSchema,
    byteSize: z
      .number()
      .int()
      .positive()
      .max(4 * 1024 * 1024),
  })
  .strict();

// A revision becomes downloadable only after every chunk has been verified.
// This contract is shared by content packages and media; transfer is separate.
export const cloudAssetManifestSchema = z
  .object({
    sha256: digestSchema,
    byteSize: z
      .number()
      .int()
      .positive()
      .max(512 * 1024 * 1024),
    chunks: z.array(cloudChunkDescriptorSchema).min(1).max(8192),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.chunks.some((chunk, index) => chunk.index !== index)) {
      context.addIssue({
        code: "custom",
        message: "Asset chunks must be contiguous",
      });
    }
    if (
      value.chunks.reduce((sum, chunk) => sum + chunk.byteSize, 0) !==
      value.byteSize
    ) {
      context.addIssue({
        code: "custom",
        message: "Asset size does not match its chunks",
      });
    }
  });

// Immutable content revisions deliberately have no scheduler state.
// The referenced package carries stable deck/card IDs and media references.
export const cloudDeckRevisionSchema = cloudLibraryIdentitySchema
  .extend({
    protocolVersion: z.literal(cloudLibraryProtocolVersion),
    deckId: z.uuid(),
    deckGeneration: z.uuid(),
    revisionId: z.uuid(),
    parentRevisionIds: z.array(z.uuid()).max(64),
    content: cloudAssetManifestSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.parentRevisionIds).size !==
        value.parentRevisionIds.length ||
      value.parentRevisionIds.includes(value.revisionId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Invalid revision ancestry",
      });
    }
  });

export type CloudLibraryIdentity = z.infer<typeof cloudLibraryIdentitySchema>;
export type CloudProgressScope = z.infer<typeof cloudProgressScopeSchema>;
export type CloudDeckControl = z.infer<typeof cloudDeckControlSchema>;
export type CloudReviewEvent = z.infer<typeof cloudReviewEventSchema>;
export type CloudAssetManifest = z.infer<typeof cloudAssetManifestSchema>;
export type CloudDeckRevision = z.infer<typeof cloudDeckRevisionSchema>;
