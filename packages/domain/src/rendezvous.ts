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
