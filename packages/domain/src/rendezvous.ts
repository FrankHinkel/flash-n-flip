import { z } from "zod";

export const rendezvousProtocolVersionSchema = z.literal(1);
export type RendezvousProtocolVersion = z.infer<
  typeof rendezvousProtocolVersionSchema
>;

export const rendezvousRoleSchema = z.enum(["INITIATOR", "JOINER"]);
export type RendezvousRole = z.infer<typeof rendezvousRoleSchema>;

export const rendezvousSessionStateSchema = z.enum([
  "CREATED",
  "JOINED",
  "COMPLETED",
]);
export type RendezvousSessionState = z.infer<
  typeof rendezvousSessionStateSchema
>;

export const rendezvousCapabilitySchema = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const rendezvousCapabilityHashSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/);

export const rendezvousEncryptedPayloadSchema = z
  .string()
  .min(1)
  // Unpadded base64url for at most 49,152 encrypted bytes.
  .max(65_536)
  .regex(/^[A-Za-z0-9_-]+$/);

export const createRendezvousSessionSchema = z
  .object({
    id: z.uuid(),
    supportedProtocolVersions: z
      .array(z.number().int().positive().max(255))
      .min(1)
      .max(4),
    initiatorCapabilityHash: rendezvousCapabilityHashSchema,
    joinerCapabilityHash: rendezvousCapabilityHashSchema,
  })
  .refine(
    (value) => value.initiatorCapabilityHash !== value.joinerCapabilityHash,
    { message: "Rendezvous capabilities must be independent" },
  );
export type CreateRendezvousSession = z.infer<
  typeof createRendezvousSessionSchema
>;

export const rendezvousSessionSchema = z.object({
  id: z.uuid(),
  protocolVersion: rendezvousProtocolVersionSchema,
  state: rendezvousSessionStateSchema,
  expiresAt: z.string().datetime(),
});
export type RendezvousSession = z.infer<typeof rendezvousSessionSchema>;

export const createRendezvousSignalSchema = z.object({
  messageId: z.uuid(),
  encryptedPayload: rendezvousEncryptedPayloadSchema,
});
export type CreateRendezvousSignal = z.infer<
  typeof createRendezvousSignalSchema
>;

export const rendezvousSignalSchema = createRendezvousSignalSchema.extend({
  sequence: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type RendezvousSignal = z.infer<typeof rendezvousSignalSchema>;

export const rendezvousSignalsQuerySchema = z.object({
  afterSequence: z.coerce.number().int().nonnegative().default(0),
});

export const rendezvousCompatibilitySchema = z.object({
  supportedProtocolVersions: z.array(rendezvousProtocolVersionSchema).min(1),
  sessionTtlSeconds: z.number().int().positive(),
  maximumEncryptedPayloadBytes: z.number().int().positive(),
});
export type RendezvousCompatibility = z.infer<
  typeof rendezvousCompatibilitySchema
>;

export const directSyncInvitationSchema = z.object({
  version: rendezvousProtocolVersionSchema,
  apiOrigin: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
    );
  }, "Rendezvous API must use HTTPS outside local development"),
  sessionId: z.uuid(),
  joinerCapability: rendezvousCapabilitySchema,
  encryptionKey: rendezvousCapabilitySchema,
  expiresAt: z.string().datetime(),
});
export type DirectSyncInvitation = z.infer<typeof directSyncInvitationSchema>;

const phaseOneCardSchema = z.object({
  id: z.uuid(),
  front: z.string().min(1).max(2_000),
  back: z.string().min(1).max(2_000),
});

export const phaseOneDeckSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  cards: z.array(phaseOneCardSchema).min(1).max(20),
  modifiedAt: z.string().datetime(),
});
export type PhaseOneDeck = z.infer<typeof phaseOneDeckSchema>;

export const phaseOneReviewSchema = z.object({
  mutationId: z.uuid(),
  deckId: z.uuid(),
  cardId: z.uuid(),
  rating: z.enum(["AGAIN", "HARD", "GOOD", "EASY"]),
  reviewedAt: z.string().datetime(),
});
export type PhaseOneReview = z.infer<typeof phaseOneReviewSchema>;

export const phaseOneSnapshotSchema = z
  .object({
    version: rendezvousProtocolVersionSchema,
    transferId: z.uuid(),
    sentAt: z.string().datetime(),
    deck: phaseOneDeckSchema,
    review: phaseOneReviewSchema,
  })
  .refine((value) => value.review.deckId === value.deck.id, {
    message: "Review must belong to the transferred deck",
  })
  .refine(
    (value) => value.deck.cards.some((card) => card.id === value.review.cardId),
    { message: "Review card must exist in the transferred deck" },
  );
export type PhaseOneSnapshot = z.infer<typeof phaseOneSnapshotSchema>;

export const encryptedRendezvousMessageSchema = z.object({
  version: rendezvousProtocolVersionSchema,
  messageId: z.uuid(),
  kind: z.enum(["OFFER", "ANSWER", "ICE_CANDIDATE", "ABORT"]),
  payload: z.unknown(),
  sentAt: z.string().datetime(),
});
export type EncryptedRendezvousMessage = z.infer<
  typeof encryptedRendezvousMessageSchema
>;
