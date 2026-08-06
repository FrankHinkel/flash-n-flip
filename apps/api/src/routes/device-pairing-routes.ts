import { and, asc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  confirmPairingSessionSchema,
  createId,
  createPairingSessionSchema,
  createPairingSignalSchema,
  joinPairingSessionSchema,
  registerDeviceSchema,
  updateDeviceSchema,
} from "@flashcards/domain";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import {
  devicePairings,
  pairingSessions,
  pairingSignals,
  userDevices,
} from "../db/schema.js";
import {
  deviceParticipatesInSession,
  effectivePairingState,
  maximumPairingAttempts,
  orderedPair,
  pairingCanSignal,
  pairingSessionTtlMs,
} from "../services/device-pairing.js";

const deviceParamsSchema = z.object({ deviceId: z.uuid() });
const sessionParamsSchema = z.object({ sessionId: z.uuid() });
const sessionDeviceQuerySchema = z.object({ deviceId: z.uuid() });

const mapDevice = (row: typeof userDevices.$inferSelect) => ({
  id: row.id,
  displayName: row.displayName,
  platform: row.platform,
  publicKey: row.publicKey,
  capabilities: row.capabilities,
  createdAt: row.createdAt.toISOString(),
  lastSeenAt: row.lastSeenAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? null,
});

const mapSession = (row: typeof pairingSessions.$inferSelect) => ({
  id: row.id,
  initiatorDeviceId: row.initiatorDeviceId,
  joiningDeviceId: row.joiningDeviceId,
  state: effectivePairingState(row),
  initiatorEphemeralPublicKey: row.initiatorEphemeralPublicKey,
  initiatorFingerprintProof: row.initiatorFingerprintProof,
  joiningEphemeralPublicKey: row.joiningEphemeralPublicKey,
  joiningFingerprintProof: row.joiningFingerprintProof,
  initiatorConfirmed: row.initiatorConfirmed,
  joiningConfirmed: row.joiningConfirmed,
  expiresAt: row.expiresAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  consumedAt: row.consumedAt?.toISOString() ?? null,
});

const cleanupExpiredPairingSessions = async (): Promise<void> => {
  const now = new Date();
  await db
    .update(pairingSessions)
    .set({ state: "EXPIRED" })
    .where(
      and(
        lte(pairingSessions.expiresAt, now),
        inArray(pairingSessions.state, ["CREATED", "JOINED"]),
      ),
    );
  await db
    .delete(pairingSignals)
    .where(
      inArray(
        pairingSignals.sessionId,
        db
          .select({ id: pairingSessions.id })
          .from(pairingSessions)
          .where(lte(pairingSessions.expiresAt, now)),
      ),
    );
};

const loadOwnedDevice = async (
  userId: string,
  deviceId: string,
): Promise<typeof userDevices.$inferSelect> => {
  const [device] = await db
    .select()
    .from(userDevices)
    .where(
      and(
        eq(userDevices.id, deviceId),
        eq(userDevices.userId, userId),
        isNull(userDevices.revokedAt),
      ),
    )
    .limit(1);
  if (!device) {
    throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  }
  return device;
};

const loadOwnedSession = async (
  userId: string,
  sessionId: string,
): Promise<typeof pairingSessions.$inferSelect> => {
  const [session] = await db
    .select()
    .from(pairingSessions)
    .where(
      and(
        eq(pairingSessions.id, sessionId),
        eq(pairingSessions.userId, userId),
      ),
    )
    .limit(1);
  if (!session) {
    throw Object.assign(new Error("Pairing session not found"), {
      statusCode: 404,
    });
  }
  return session;
};

export const registerDevicePairingRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.addHook("onSend", async (_request, reply) => {
    reply.header("cache-control", "no-store");
  });

  app.post(
    "/devices",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const input = registerDeviceSchema.parse(request.body);
      const [sameId] = await db
        .select({ publicKey: userDevices.publicKey })
        .from(userDevices)
        .where(
          and(
            eq(userDevices.id, input.id),
            eq(userDevices.userId, request.user.id),
          ),
        )
        .limit(1);
      if (sameId && sameId.publicKey !== input.publicKey) {
        return reply
          .code(409)
          .send({ message: "Device identity key cannot be replaced" });
      }
      const [sameKey] = await db
        .select({ id: userDevices.id })
        .from(userDevices)
        .where(
          and(
            eq(userDevices.userId, request.user.id),
            eq(userDevices.publicKey, input.publicKey),
          ),
        )
        .limit(1);
      if (sameKey && sameKey.id !== input.id) {
        return reply.code(409).send({ message: "Device key already exists" });
      }

      await db
        .insert(userDevices)
        .values({
          id: input.id,
          userId: request.user.id,
          displayName: input.displayName,
          platform: input.platform,
          publicKey: input.publicKey,
          capabilities: input.capabilities,
        })
        .onConflictDoNothing();
      const [updated] = await db
        .update(userDevices)
        .set({
          displayName: input.displayName,
          platform: input.platform,
          capabilities: input.capabilities,
          lastSeenAt: new Date(),
        })
        .where(
          and(
            eq(userDevices.id, input.id),
            eq(userDevices.userId, request.user.id),
            isNull(userDevices.revokedAt),
          ),
        )
        .returning();
      if (!updated) {
        return reply.code(409).send({ message: "Device ID is unavailable" });
      }
      return reply.code(201).send(mapDevice(updated));
    },
  );

  app.get("/devices", { preHandler: authenticate }, async (request) => {
    const [devices, pairings] = await Promise.all([
      db
        .select()
        .from(userDevices)
        .where(eq(userDevices.userId, request.user.id))
        .orderBy(asc(userDevices.createdAt)),
      db
        .select()
        .from(devicePairings)
        .where(eq(devicePairings.userId, request.user.id))
        .orderBy(asc(devicePairings.createdAt)),
    ]);
    return {
      devices: devices.map(mapDevice),
      pairings: pairings.map((pairing) => ({
        id: pairing.id,
        deviceAId: pairing.deviceAId,
        deviceBId: pairing.deviceBId,
        createdAt: pairing.createdAt.toISOString(),
        confirmedAt: pairing.confirmedAt.toISOString(),
        revokedAt: pairing.revokedAt?.toISOString() ?? null,
      })),
    };
  });

  app.patch(
    "/devices/:deviceId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deviceId } = deviceParamsSchema.parse(request.params);
      const input = updateDeviceSchema.parse(request.body);
      const [updated] = await db
        .update(userDevices)
        .set({ displayName: input.displayName, lastSeenAt: new Date() })
        .where(
          and(
            eq(userDevices.id, deviceId),
            eq(userDevices.userId, request.user.id),
            isNull(userDevices.revokedAt),
          ),
        )
        .returning();
      if (!updated) {
        return reply.code(404).send({ message: "Device not found" });
      }
      return mapDevice(updated);
    },
  );

  app.delete(
    "/devices/:deviceId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deviceId } = deviceParamsSchema.parse(request.params);
      const now = new Date();
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(userDevices)
          .set({ revokedAt: now, lastSeenAt: now })
          .where(
            and(
              eq(userDevices.id, deviceId),
              eq(userDevices.userId, request.user.id),
              isNull(userDevices.revokedAt),
            ),
          )
          .returning({ id: userDevices.id });
        if (!updated) {
          throw Object.assign(new Error("Device not found"), {
            statusCode: 404,
          });
        }
        await tx
          .update(devicePairings)
          .set({ revokedAt: now })
          .where(
            and(
              eq(devicePairings.userId, request.user.id),
              isNull(devicePairings.revokedAt),
              or(
                eq(devicePairings.deviceAId, deviceId),
                eq(devicePairings.deviceBId, deviceId),
              ),
            ),
          );
        await tx
          .update(pairingSessions)
          .set({ state: "CANCELLED", consumedAt: now })
          .where(
            and(
              eq(pairingSessions.userId, request.user.id),
              inArray(pairingSessions.state, ["CREATED", "JOINED"]),
              or(
                eq(pairingSessions.initiatorDeviceId, deviceId),
                eq(pairingSessions.joiningDeviceId, deviceId),
              ),
            ),
          );
      });
      return reply.code(204).send();
    },
  );

  app.post(
    "/pairing/sessions",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredPairingSessions();
      const input = createPairingSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.initiatorDeviceId);
      const now = new Date();
      const [session] = await db
        .insert(pairingSessions)
        .values({
          id: createId(),
          userId: request.user.id,
          initiatorDeviceId: input.initiatorDeviceId,
          initiatorEphemeralPublicKey: input.initiatorEphemeralPublicKey,
          initiatorFingerprintProof: input.initiatorFingerprintProof,
          expiresAt: new Date(now.getTime() + pairingSessionTtlMs),
        })
        .returning();
      if (!session) throw new Error("Pairing session could not be created");
      return reply.code(201).send(mapSession(session));
    },
  );

  app.get(
    "/pairing/sessions/:sessionId",
    { preHandler: authenticate },
    async (request, reply) => {
      await cleanupExpiredPairingSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const { deviceId } = sessionDeviceQuerySchema.parse(request.query);
      await loadOwnedDevice(request.user.id, deviceId);
      const session = await loadOwnedSession(request.user.id, sessionId);
      if (!deviceParticipatesInSession({ ...session, deviceId })) {
        return reply.code(404).send({ message: "Pairing session not found" });
      }
      return mapSession(session);
    },
  );

  app.post(
    "/pairing/sessions/:sessionId/join",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredPairingSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = joinPairingSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.joiningDeviceId);
      const session = await loadOwnedSession(request.user.id, sessionId);
      const state = effectivePairingState(session);
      if (state === "EXPIRED") {
        return reply.code(410).send({ message: "Pairing session expired" });
      }
      if (session.initiatorDeviceId === input.joiningDeviceId) {
        return reply
          .code(400)
          .send({ message: "A device cannot pair with itself" });
      }
      if (session.attemptCount >= maximumPairingAttempts) {
        return reply
          .code(429)
          .send({ message: "Pairing session attempt limit reached" });
      }
      if (
        session.joiningDeviceId &&
        session.joiningDeviceId !== input.joiningDeviceId
      ) {
        return reply.code(409).send({ message: "Pairing session is in use" });
      }
      const [updated] = await db
        .update(pairingSessions)
        .set({
          joiningDeviceId: input.joiningDeviceId,
          joiningEphemeralPublicKey: input.joiningEphemeralPublicKey,
          joiningFingerprintProof: input.joiningFingerprintProof,
          state: "JOINED",
          attemptCount: session.attemptCount + 1,
        })
        .where(
          and(
            eq(pairingSessions.id, sessionId),
            eq(pairingSessions.userId, request.user.id),
            inArray(pairingSessions.state, ["CREATED", "JOINED"]),
          ),
        )
        .returning();
      if (!updated) {
        return reply.code(409).send({ message: "Pairing session changed" });
      }
      return mapSession(updated);
    },
  );

  app.post(
    "/pairing/sessions/:sessionId/confirm",
    { preHandler: authenticate },
    async (request, reply) => {
      await cleanupExpiredPairingSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = confirmPairingSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.deviceId);
      const session = await loadOwnedSession(request.user.id, sessionId);
      if (effectivePairingState(session) === "EXPIRED") {
        return reply.code(410).send({ message: "Pairing session expired" });
      }
      if (
        !deviceParticipatesInSession({ ...session, deviceId: input.deviceId })
      ) {
        return reply.code(404).send({ message: "Pairing session not found" });
      }
      if (!session.joiningDeviceId || session.state !== "JOINED") {
        return reply
          .code(409)
          .send({ message: "Pairing session is not ready" });
      }
      const isInitiator = input.deviceId === session.initiatorDeviceId;
      await db
        .update(pairingSessions)
        .set(
          isInitiator
            ? {
                initiatorConfirmed: true,
                initiatorConfirmationProof: input.confirmationProof,
              }
            : {
                joiningConfirmed: true,
                joiningConfirmationProof: input.confirmationProof,
              },
        )
        .where(eq(pairingSessions.id, sessionId));
      const updated = await loadOwnedSession(request.user.id, sessionId);
      if (updated.initiatorConfirmed && updated.joiningConfirmed) {
        const now = new Date();
        const [deviceAId, deviceBId] = orderedPair(
          updated.initiatorDeviceId,
          updated.joiningDeviceId!,
        );
        await db.transaction(async (tx) => {
          await tx
            .insert(devicePairings)
            .values({
              id: createId(),
              userId: request.user.id,
              deviceAId,
              deviceBId,
              confirmedAt: now,
            })
            .onConflictDoUpdate({
              target: [
                devicePairings.userId,
                devicePairings.deviceAId,
                devicePairings.deviceBId,
              ],
              set: { confirmedAt: now, revokedAt: null },
            });
          await tx
            .update(pairingSessions)
            .set({ state: "CONFIRMED", consumedAt: now })
            .where(eq(pairingSessions.id, sessionId));
        });
      }
      return mapSession(await loadOwnedSession(request.user.id, sessionId));
    },
  );

  app.post(
    "/pairing/sessions/:sessionId/cancel",
    { preHandler: authenticate },
    async (request, reply) => {
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const { deviceId } = z.object({ deviceId: z.uuid() }).parse(request.body);
      await loadOwnedDevice(request.user.id, deviceId);
      const session = await loadOwnedSession(request.user.id, sessionId);
      if (!deviceParticipatesInSession({ ...session, deviceId })) {
        return reply.code(404).send({ message: "Pairing session not found" });
      }
      await db
        .update(pairingSessions)
        .set({ state: "CANCELLED", consumedAt: new Date() })
        .where(eq(pairingSessions.id, sessionId));
      return reply.code(204).send();
    },
  );

  app.post(
    "/pairing/sessions/:sessionId/signals",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredPairingSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = createPairingSignalSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.senderDeviceId);
      const session = await loadOwnedSession(request.user.id, sessionId);
      if (
        !pairingCanSignal({
          ...session,
          state: effectivePairingState(session),
          senderDeviceId: input.senderDeviceId,
          recipientDeviceId: input.recipientDeviceId,
        })
      ) {
        return reply.code(409).send({ message: "Signal is not allowed" });
      }
      const [signal] = await db
        .insert(pairingSignals)
        .values({
          id: createId(),
          sessionId,
          senderDeviceId: input.senderDeviceId,
          recipientDeviceId: input.recipientDeviceId,
          type: input.type,
          payload: input.payload,
        })
        .returning();
      if (!signal) throw new Error("Pairing signal could not be stored");
      return reply.code(201).send({
        ...signal,
        createdAt: signal.createdAt.toISOString(),
      });
    },
  );

  app.get(
    "/pairing/sessions/:sessionId/signals",
    { preHandler: authenticate },
    async (request, reply) => {
      await cleanupExpiredPairingSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const query = z
        .object({
          deviceId: z.uuid(),
          afterSequence: z.coerce.number().int().nonnegative().default(0),
        })
        .parse(request.query);
      await loadOwnedDevice(request.user.id, query.deviceId);
      const session = await loadOwnedSession(request.user.id, sessionId);
      if (
        !deviceParticipatesInSession({ ...session, deviceId: query.deviceId })
      ) {
        return reply.code(404).send({ message: "Pairing session not found" });
      }
      const state = effectivePairingState(session);
      if (state !== "JOINED" && state !== "CONFIRMED") {
        return reply
          .code(409)
          .send({ message: "Pairing signaling is unavailable" });
      }
      if (session.expiresAt <= new Date()) {
        return reply.code(410).send({ message: "Pairing signaling expired" });
      }
      const rows = await db
        .select()
        .from(pairingSignals)
        .where(
          and(
            eq(pairingSignals.sessionId, sessionId),
            eq(pairingSignals.recipientDeviceId, query.deviceId),
            gt(pairingSignals.sequence, query.afterSequence),
          ),
        )
        .orderBy(asc(pairingSignals.sequence))
        .limit(100);
      return {
        afterSequence: rows.at(-1)?.sequence ?? query.afterSequence,
        signals: rows.map((signal) => ({
          ...signal,
          createdAt: signal.createdAt.toISOString(),
        })),
      };
    },
  );
};
