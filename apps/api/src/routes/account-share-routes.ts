import { createHash, timingSafeEqual } from "node:crypto";

import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  cancelAccountShareSessionSchema,
  completeAccountShareSessionSchema,
  confirmAccountShareSessionSchema,
  createAccountShareSessionSchema,
  createAccountShareSignalSchema,
  createId,
  joinAccountShareSessionSchema,
} from "@flashcards/domain";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import {
  accountShareSessions,
  accountShareSignals,
  userDevices,
  users,
} from "../db/schema.js";

const sessionParamsSchema = z.object({ sessionId: z.uuid() });
const sessionDeviceQuerySchema = z.object({ deviceId: z.uuid() });
const accountShareSessionTtlMs = 15 * 60 * 1000;
const maximumClaimAttempts = 8;

const secretHash = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex");

const equalHash = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

const cleanupExpiredSessions = async (): Promise<void> => {
  await db
    .delete(accountShareSessions)
    .where(lte(accountShareSessions.expiresAt, new Date()));
};

const loadOwnedDevice = async (userId: string, deviceId: string) => {
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

const loadSession = async (sessionId: string) => {
  const [session] = await db
    .select()
    .from(accountShareSessions)
    .where(eq(accountShareSessions.id, sessionId))
    .limit(1);
  if (!session) {
    throw Object.assign(new Error("Share session not found"), {
      statusCode: 404,
    });
  }
  return session;
};

const loadParticipantSession = async (userId: string, sessionId: string) => {
  const [session] = await db
    .select()
    .from(accountShareSessions)
    .where(
      and(
        eq(accountShareSessions.id, sessionId),
        or(
          eq(accountShareSessions.senderUserId, userId),
          eq(accountShareSessions.recipientUserId, userId),
        ),
      ),
    )
    .limit(1);
  if (!session) {
    throw Object.assign(new Error("Share session not found"), {
      statusCode: 404,
    });
  }
  return session;
};

const mapSession = async (
  session: typeof accountShareSessions.$inferSelect,
) => {
  const [
    senderUserRows,
    senderDeviceRows,
    recipientUserRows,
    recipientDeviceRows,
  ] = await Promise.all([
    db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, session.senderUserId))
      .limit(1),
    db
      .select({ displayName: userDevices.displayName })
      .from(userDevices)
      .where(eq(userDevices.id, session.senderDeviceId))
      .limit(1),
    session.recipientUserId
      ? db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, session.recipientUserId))
          .limit(1)
      : Promise.resolve([]),
    session.recipientDeviceId
      ? db
          .select({ displayName: userDevices.displayName })
          .from(userDevices)
          .where(eq(userDevices.id, session.recipientDeviceId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const sender = senderUserRows[0];
  const senderDevice = senderDeviceRows[0];
  if (!sender || !senderDevice) {
    throw new Error("Share session participant is unavailable");
  }
  return {
    id: session.id,
    senderDeviceId: session.senderDeviceId,
    recipientDeviceId: session.recipientDeviceId,
    state: session.state,
    senderDisplayName: sender.displayName,
    recipientDisplayName: recipientUserRows[0]?.displayName ?? null,
    senderDeviceName: senderDevice.displayName,
    recipientDeviceName: recipientDeviceRows[0]?.displayName ?? null,
    senderEphemeralPublicKey: session.senderEphemeralPublicKey,
    senderFingerprintProof: session.senderFingerprintProof,
    recipientEphemeralPublicKey: session.recipientEphemeralPublicKey,
    recipientFingerprintProof: session.recipientFingerprintProof,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    consumedAt: session.consumedAt?.toISOString() ?? null,
  };
};

const deviceParticipates = (
  session: typeof accountShareSessions.$inferSelect,
  userId: string,
  deviceId: string,
): boolean =>
  (session.senderUserId === userId && session.senderDeviceId === deviceId) ||
  (session.recipientUserId === userId &&
    session.recipientDeviceId === deviceId);

export const registerAccountShareRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.post(
    "/account-shares",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredSessions();
      const input = createAccountShareSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.senderDeviceId);
      const [session] = await db
        .insert(accountShareSessions)
        .values({
          id: input.id,
          senderUserId: request.user.id,
          senderDeviceId: input.senderDeviceId,
          secretHash: input.secretHash,
          senderEphemeralPublicKey: input.senderEphemeralPublicKey,
          senderFingerprintProof: input.senderFingerprintProof,
          expiresAt: new Date(Date.now() + accountShareSessionTtlMs),
        })
        .returning();
      if (!session) throw new Error("Share session could not be created");
      return reply.code(201).send(await mapSession(session));
    },
  );

  app.post(
    "/account-shares/:sessionId/join",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = joinAccountShareSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.recipientDeviceId);
      const session = await loadSession(sessionId);
      if (session.senderUserId === request.user.id) {
        return reply.code(409).send({
          message: "Deck sharing requires a different account",
        });
      }
      if (session.attemptCount >= maximumClaimAttempts) {
        return reply.code(429).send({ message: "Share claim limit reached" });
      }
      if (!equalHash(session.secretHash, secretHash(input.secret))) {
        await db
          .update(accountShareSessions)
          .set({ attemptCount: session.attemptCount + 1 })
          .where(eq(accountShareSessions.id, session.id));
        return reply
          .code(400)
          .send({ message: "Share invitation is invalid or expired" });
      }
      if (
        session.recipientUserId &&
        (session.recipientUserId !== request.user.id ||
          session.recipientDeviceId !== input.recipientDeviceId)
      ) {
        return reply.code(409).send({ message: "Share invitation is in use" });
      }
      const joinCondition = session.recipientUserId
        ? and(
            eq(accountShareSessions.id, session.id),
            eq(accountShareSessions.state, "CLAIMED"),
            eq(accountShareSessions.recipientUserId, request.user.id),
            eq(accountShareSessions.recipientDeviceId, input.recipientDeviceId),
          )
        : and(
            eq(accountShareSessions.id, session.id),
            eq(accountShareSessions.state, "CREATED"),
          );
      const [updated] = await db
        .update(accountShareSessions)
        .set({
          recipientUserId: request.user.id,
          recipientDeviceId: input.recipientDeviceId,
          recipientEphemeralPublicKey: input.recipientEphemeralPublicKey,
          recipientFingerprintProof: input.recipientFingerprintProof,
          state: "CLAIMED",
          attemptCount: session.attemptCount + 1,
        })
        .where(
          and(joinCondition, gt(accountShareSessions.expiresAt, new Date())),
        )
        .returning();
      if (!updated) {
        return reply.code(409).send({ message: "Share invitation changed" });
      }
      return reply.send(await mapSession(updated));
    },
  );

  app.get(
    "/account-shares/:sessionId",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 180, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const { deviceId } = sessionDeviceQuerySchema.parse(request.query);
      await loadOwnedDevice(request.user.id, deviceId);
      const session = await loadParticipantSession(request.user.id, sessionId);
      if (!deviceParticipates(session, request.user.id, deviceId)) {
        return reply.code(404).send({ message: "Share session not found" });
      }
      return mapSession(session);
    },
  );

  app.post(
    "/account-shares/:sessionId/confirm",
    { preHandler: authenticate },
    async (request, reply) => {
      await cleanupExpiredSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = confirmAccountShareSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.senderDeviceId);
      const session = await loadParticipantSession(request.user.id, sessionId);
      if (
        session.senderUserId !== request.user.id ||
        session.senderDeviceId !== input.senderDeviceId
      ) {
        return reply.code(404).send({ message: "Share session not found" });
      }
      if (
        session.state !== "CLAIMED" ||
        !session.recipientUserId ||
        !session.recipientDeviceId
      ) {
        return reply.code(409).send({ message: "Share is not ready" });
      }
      const [updated] = await db
        .update(accountShareSessions)
        .set({ state: "CONFIRMED" })
        .where(
          and(
            eq(accountShareSessions.id, session.id),
            eq(accountShareSessions.state, "CLAIMED"),
            gt(accountShareSessions.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!updated) {
        return reply.code(409).send({ message: "Share invitation changed" });
      }
      return mapSession(updated);
    },
  );

  app.post(
    "/account-shares/:sessionId/complete",
    { preHandler: authenticate },
    async (request, reply) => {
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = completeAccountShareSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.recipientDeviceId);
      const session = await loadParticipantSession(request.user.id, sessionId);
      if (
        session.recipientUserId !== request.user.id ||
        session.recipientDeviceId !== input.recipientDeviceId
      ) {
        return reply.code(404).send({ message: "Share session not found" });
      }
      const now = new Date();
      const [updated] = await db.transaction(async (tx) => {
        const rows = await tx
          .update(accountShareSessions)
          .set({ state: "COMPLETED", consumedAt: now })
          .where(
            and(
              eq(accountShareSessions.id, session.id),
              eq(accountShareSessions.state, "CONFIRMED"),
              gt(accountShareSessions.expiresAt, now),
            ),
          )
          .returning();
        await tx
          .delete(accountShareSignals)
          .where(eq(accountShareSignals.sessionId, session.id));
        return rows;
      });
      if (!updated) {
        return reply.code(409).send({ message: "Share is not active" });
      }
      return mapSession(updated);
    },
  );

  app.post(
    "/account-shares/:sessionId/cancel",
    { preHandler: authenticate },
    async (request, reply) => {
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const { deviceId } = cancelAccountShareSessionSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, deviceId);
      const session = await loadParticipantSession(request.user.id, sessionId);
      if (!deviceParticipates(session, request.user.id, deviceId)) {
        return reply.code(404).send({ message: "Share session not found" });
      }
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(accountShareSessions)
          .set({ state: "CANCELLED", consumedAt: now })
          .where(eq(accountShareSessions.id, session.id));
        await tx
          .delete(accountShareSignals)
          .where(eq(accountShareSignals.sessionId, session.id));
      });
      return reply.code(204).send();
    },
  );

  app.post(
    "/account-shares/:sessionId/signals",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 120, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const input = createAccountShareSignalSchema.parse(request.body);
      await loadOwnedDevice(request.user.id, input.senderDeviceId);
      const session = await loadParticipantSession(request.user.id, sessionId);
      if (
        session.state !== "CONFIRMED" ||
        !session.recipientDeviceId ||
        !deviceParticipates(session, request.user.id, input.senderDeviceId) ||
        ![session.senderDeviceId, session.recipientDeviceId].includes(
          input.recipientDeviceId,
        ) ||
        input.senderDeviceId === input.recipientDeviceId
      ) {
        return reply.code(409).send({ message: "Signal is not allowed" });
      }
      const existingSignals = await db
        .select({ id: accountShareSignals.id })
        .from(accountShareSignals)
        .where(eq(accountShareSignals.sessionId, session.id))
        .limit(256);
      if (existingSignals.length >= 256) {
        return reply.code(429).send({ message: "Share signal limit reached" });
      }
      const [signal] = await db
        .insert(accountShareSignals)
        .values({
          id: createId(),
          sessionId,
          senderDeviceId: input.senderDeviceId,
          recipientDeviceId: input.recipientDeviceId,
          type: input.type,
          payload: input.payload,
        })
        .returning();
      if (!signal) throw new Error("Share signal could not be stored");
      return reply.code(201).send({
        ...signal,
        createdAt: signal.createdAt.toISOString(),
      });
    },
  );

  app.get(
    "/account-shares/:sessionId/signals",
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 240, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      await cleanupExpiredSessions();
      const { sessionId } = sessionParamsSchema.parse(request.params);
      const query = z
        .object({
          deviceId: z.uuid(),
          afterSequence: z.coerce.number().int().nonnegative().default(0),
        })
        .parse(request.query);
      await loadOwnedDevice(request.user.id, query.deviceId);
      const session = await loadParticipantSession(request.user.id, sessionId);
      if (
        session.state !== "CONFIRMED" ||
        !deviceParticipates(session, request.user.id, query.deviceId)
      ) {
        return reply
          .code(409)
          .send({ message: "Share signaling is unavailable" });
      }
      const rows = await db
        .select()
        .from(accountShareSignals)
        .where(
          and(
            eq(accountShareSignals.sessionId, session.id),
            eq(accountShareSignals.recipientDeviceId, query.deviceId),
            gt(accountShareSignals.sequence, query.afterSequence),
          ),
        )
        .orderBy(asc(accountShareSignals.sequence))
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
