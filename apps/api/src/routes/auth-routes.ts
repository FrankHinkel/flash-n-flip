import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";

import { and, eq, gt, inArray, isNull, notInArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  changePasswordSchema,
  createId,
  resetPasswordSchema,
} from "@flashcards/domain";

import {
  authenticate,
  authenticateSession,
  hashPassword,
  issueTokens,
  loadAuthUser,
  verifyPassword,
} from "../auth.js";
import type { AuthUser } from "../auth.js";
import type { AppConfig } from "../config.js";
import { db } from "../db/client.js";
import {
  authTokens,
  cardProgress,
  cards,
  decks,
  legalAcceptances,
  media,
  publications,
  reviewEvents,
  sessions,
  userRoles,
  subscriptions,
  users,
} from "../db/schema.js";
import { matchesAdminAccessPassword } from "../services/admin-access-password.js";
import { tunnelAdminEmail } from "../services/auth-access-policy.js";

const currentTermsVersion = "2026-07-25";
const currentPrivacyVersion = "2026-07-25";

const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(128),
  deviceName: z.string().trim().min(1).max(100),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(["en", "de"]).default("en"),
  deviceName: z.string().trim().min(1).max(100),
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
});

const adminAccessSchema = z.object({
  accessPassword: z.string().trim().min(1).max(512),
  deviceName: z.string().trim().min(1).max(100),
});

const daysFromNow = (days: number): Date =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const hoursFromNow = (hours: number): Date =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

const tokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const passwordResetPurpose = "PASSWORD_RESET";
const passwordRecoveryCodeTtlMs = 10 * 60 * 1000;
const passwordRecoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const createPasswordRecoveryCode = (): {
  formatted: string;
  normalized: string;
} => {
  const normalized = [...randomBytes(12)]
    .map((byte) => passwordRecoveryAlphabet[byte & 31])
    .join("");
  return {
    formatted: normalized.match(/.{1,4}/g)?.join("-") ?? normalized,
    normalized,
  };
};

export const registerAuthRoutes = async (
  app: FastifyInstance,
  config: AppConfig,
  adminAccessPassword: string | null,
): Promise<void> => {
  app.post(
    "/auth/admin-access",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const input = adminAccessSchema.parse(request.body);
      if (!adminAccessPassword) {
        return reply
          .code(503)
          .send({ message: "Admin tunnel access is not configured" });
      }
      if (
        !matchesAdminAccessPassword(adminAccessPassword, input.accessPassword)
      ) {
        return reply.code(401).send({ message: "Invalid credentials" });
      }

      let [admin] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, tunnelAdminEmail), isNull(users.deletedAt)))
        .limit(1);
      if (!admin) {
        const userId = createId();
        await db
          .insert(users)
          .values({
            id: userId,
            email: tunnelAdminEmail,
            passwordHash: await hashPassword(
              randomBytes(32).toString("base64url"),
            ),
            displayName: "Tunnel administrator",
            locale: "en",
            emailVerified: true,
          })
          .onConflictDoNothing();
        [admin] = await db
          .select()
          .from(users)
          .where(
            and(eq(users.email, tunnelAdminEmail), isNull(users.deletedAt)),
          )
          .limit(1);
      }
      if (!admin) {
        throw new Error("Tunnel administrator could not be provisioned");
      }

      await db
        .insert(userRoles)
        .values({ userId: admin.id, role: "ADMIN" })
        .onConflictDoNothing();
      const sessionId = createId();
      await db.insert(sessions).values({
        id: sessionId,
        userId: admin.id,
        deviceName: input.deviceName,
        expiresAt: hoursFromNow(8),
      });
      const authUser = {
        id: admin.id,
        email: admin.email,
        roles: ["ADMIN" as const],
        sessionId,
        passwordChangeRequired: false,
      };
      return {
        user: authUser,
        ...issueTokens(app, config, authUser),
      };
    },
  );

  app.post("/auth/register", async (request, reply) => {
    const input = registerSchema.parse(request.body);
    if (!config.PUBLIC_REGISTRATION_ENABLED) {
      return reply.code(403).send({ message: "Registration is disabled" });
    }
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing.length > 0) {
      return reply.code(409).send({ message: "Account already exists" });
    }

    const userId = createId();
    const sessionId = createId();
    const expiresAt = daysFromNow(config.REFRESH_TOKEN_TTL_DAYS);
    const passwordHash = await hashPassword(input.password);
    const verificationToken = randomBytes(32).toString("base64url");

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        locale: input.locale,
      });
      await tx.insert(userRoles).values([
        { userId, role: "USER" },
        { userId, role: "AUTHOR" },
      ]);
      await tx.insert(sessions).values({
        id: sessionId,
        userId,
        deviceName: input.deviceName,
        expiresAt,
      });
      await tx.insert(legalAcceptances).values([
        {
          userId,
          document: "terms",
          version: input.termsVersion,
          locale: input.locale,
        },
        {
          userId,
          document: "privacy",
          version: input.privacyVersion,
          locale: input.locale,
        },
      ]);
      await tx.insert(authTokens).values({
        id: createId(),
        userId,
        purpose: "VERIFY_EMAIL",
        tokenHash: tokenHash(verificationToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    const user = {
      id: userId,
      email: input.email,
      roles: ["USER", "AUTHOR"] as const,
      sessionId,
      passwordChangeRequired: false,
    };
    return reply.code(201).send({
      user,
      ...issueTokens(app, config, {
        ...user,
        roles: [...user.roles],
      }),
      ...(config.NODE_ENV === "development"
        ? { developmentVerificationToken: verificationToken }
        : {}),
    });
  });

  app.post("/auth/verify-email", async (request, reply) => {
    const { token } = z
      .object({ token: z.string().min(32).max(200) })
      .parse(request.body);
    const [record] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash(token)),
          eq(authTokens.purpose, "VERIFY_EMAIL"),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!record)
      return reply.code(400).send({ message: "Invalid or expired token" });
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, record.userId));
      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(eq(authTokens.id, record.id));
    });
    return reply.code(204).send();
  });

  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          keyGenerator: (request) => {
            const email = (request.body as { email?: unknown } | null)?.email;
            return typeof email === "string"
              ? `login:${email.trim().toLowerCase()}`
              : `login:${request.ip}`;
          },
        },
      },
    },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
        .limit(1);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        return reply.code(401).send({ message: "Invalid credentials" });
      }

      const roles = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, user.id));
      const sessionId = createId();
      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        deviceName: input.deviceName,
        expiresAt: daysFromNow(config.REFRESH_TOKEN_TTL_DAYS),
      });
      const authUser = {
        id: user.id,
        email: user.email,
        roles: roles.map((item) => item.role),
        sessionId,
        passwordChangeRequired: user.passwordChangeRequired,
      };
      return {
        user: authUser,
        ...issueTokens(app, config, authUser),
      };
    },
  );

  app.post("/auth/refresh", async (request, reply) => {
    const input = z
      .object({ refreshToken: z.string().min(1) })
      .parse(request.body);
    const decoded = await app.jwt.verify<AuthUser>(input.refreshToken);
    if (decoded.tokenType !== "refresh") {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }
    const user = await loadAuthUser(decoded.id, decoded.sessionId, "refresh");
    if (!user) {
      return reply.code(401).send({ message: "Session expired" });
    }
    return issueTokens(app, config, {
      id: user.id,
      email: user.email,
      roles: user.roles,
      sessionId: user.sessionId,
      passwordChangeRequired: user.passwordChangeRequired,
    });
  });

  app.post(
    "/auth/logout",
    { preHandler: authenticateSession },
    async (request, reply) => {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, request.user.sessionId));
      return reply.code(204).send();
    },
  );

  app.post(
    "/auth/password/change",
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const input = changePasswordSchema.parse(request.body);
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);
      if (
        !user ||
        !(await verifyPassword(input.currentPassword, user.passwordHash))
      ) {
        return reply
          .code(400)
          .send({ message: "Current password is incorrect" });
      }
      if (await verifyPassword(input.newPassword, user.passwordHash)) {
        return reply.code(400).send({ message: "Choose a different password" });
      }

      const passwordHash = await hashPassword(input.newPassword);
      const changed = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(
            and(
              eq(users.id, request.user.id),
              eq(users.passwordHash, user.passwordHash),
            ),
          )
          .returning({ id: users.id });
        if (!updated) return false;

        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(sessions.userId, request.user.id),
              notInArray(sessions.id, [request.user.sessionId]),
              isNull(sessions.revokedAt),
            ),
          );
        await tx
          .update(authTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(authTokens.userId, request.user.id),
              eq(authTokens.purpose, passwordResetPurpose),
              isNull(authTokens.usedAt),
            ),
          );
        return true;
      });
      if (!changed) {
        return reply
          .code(409)
          .send({ message: "Password changed elsewhere. Sign in again." });
      }
      return reply.code(204).send();
    },
  );

  app.post(
    "/auth/password/recovery-code",
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const recoveryCode = createPasswordRecoveryCode();
      const expiresAt = new Date(Date.now() + passwordRecoveryCodeTtlMs);
      await db.transaction(async (tx) => {
        await tx
          .delete(authTokens)
          .where(
            and(
              eq(authTokens.userId, request.user.id),
              eq(authTokens.purpose, passwordResetPurpose),
            ),
          );
        await tx.insert(authTokens).values({
          id: createId(),
          userId: request.user.id,
          purpose: passwordResetPurpose,
          tokenHash: tokenHash(recoveryCode.normalized),
          expiresAt,
        });
      });
      return reply.code(201).send({
        recoveryCode: recoveryCode.formatted,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );

  app.post(
    "/auth/password/reset",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          keyGenerator: (request) => {
            const email = (request.body as { email?: unknown } | null)?.email;
            return typeof email === "string"
              ? `password-reset:${email.trim().toLowerCase()}`
              : `password-reset:${request.ip}`;
          },
        },
      },
    },
    async (request, reply) => {
      const input = resetPasswordSchema.parse(request.body);
      const [record] = await db
        .select({
          tokenId: authTokens.id,
          userId: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
        })
        .from(authTokens)
        .innerJoin(users, eq(users.id, authTokens.userId))
        .where(
          and(
            eq(authTokens.tokenHash, tokenHash(input.recoveryCode)),
            eq(authTokens.purpose, passwordResetPurpose),
            isNull(authTokens.usedAt),
            gt(authTokens.expiresAt, new Date()),
            eq(users.email, input.email),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);
      if (!record) {
        return reply
          .code(400)
          .send({ message: "Invalid or expired recovery code" });
      }
      if (await verifyPassword(input.newPassword, record.passwordHash)) {
        return reply.code(400).send({ message: "Choose a different password" });
      }

      const passwordHash = await hashPassword(input.newPassword);
      const sessionId = createId();
      const reset = await db.transaction(async (tx) => {
        const [consumed] = await tx
          .update(authTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(authTokens.id, record.tokenId),
              isNull(authTokens.usedAt),
              gt(authTokens.expiresAt, new Date()),
            ),
          )
          .returning({ id: authTokens.id });
        if (!consumed) return false;

        await tx
          .update(users)
          .set({
            passwordHash,
            passwordChangeRequired: false,
            updatedAt: new Date(),
          })
          .where(eq(users.id, record.userId));
        await tx
          .update(authTokens)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(authTokens.userId, record.userId),
              eq(authTokens.purpose, passwordResetPurpose),
              isNull(authTokens.usedAt),
            ),
          );
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(eq(sessions.userId, record.userId), isNull(sessions.revokedAt)),
          );
        await tx.insert(sessions).values({
          id: sessionId,
          userId: record.userId,
          deviceName: input.deviceName,
          expiresAt: daysFromNow(config.REFRESH_TOKEN_TTL_DAYS),
        });
        return true;
      });
      if (!reset) {
        return reply
          .code(400)
          .send({ message: "Invalid or expired recovery code" });
      }

      const roles = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, record.userId));
      const authUser = {
        id: record.userId,
        email: record.email,
        roles: roles.map((item) => item.role),
        sessionId,
        passwordChangeRequired: false,
      };
      return {
        user: authUser,
        ...issueTokens(app, config, authUser),
      };
    },
  );

  app.post(
    "/auth/password/change-required",
    { preHandler: authenticateSession },
    async (request, reply) => {
      if (!request.user.passwordChangeRequired) {
        return reply
          .code(409)
          .send({ message: "Password change is not required" });
      }
      const input = z
        .object({
          newPassword: z.string().min(12).max(128),
          termsAccepted: z.literal(true),
          privacyAcknowledged: z.literal(true),
          locale: z.enum(["de", "en"]),
        })
        .parse(request.body);
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);
      if (!user) {
        return reply.code(401).send({ message: "Unauthorized" });
      }
      if (await verifyPassword(input.newPassword, user.passwordHash)) {
        return reply.code(400).send({
          message: "Choose a password different from the temporary password",
        });
      }
      const passwordHash = await hashPassword(input.newPassword);
      const changed = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(users)
          .set({
            passwordHash,
            passwordChangeRequired: false,
            locale: input.locale,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(users.id, request.user.id),
              eq(users.passwordHash, user.passwordHash),
              eq(users.passwordChangeRequired, true),
            ),
          )
          .returning({ id: users.id });
        if (!updated) return false;
        await tx
          .insert(legalAcceptances)
          .values([
            {
              userId: request.user.id,
              document: "terms",
              version: currentTermsVersion,
              locale: input.locale,
            },
            {
              userId: request.user.id,
              document: "privacy",
              version: currentPrivacyVersion,
              locale: input.locale,
            },
          ])
          .onConflictDoNothing();
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(sessions.userId, request.user.id),
              notInArray(sessions.id, [request.user.sessionId]),
              isNull(sessions.revokedAt),
            ),
          );
        return true;
      });
      if (!changed) {
        return reply
          .code(409)
          .send({ message: "The start PIN changed. Sign in again." });
      }
      return reply.code(204).send();
    },
  );

  app.get("/auth/me", { preHandler: authenticateSession }, async (request) => {
    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        locale: users.locale,
        passwordChangeRequired: users.passwordChangeRequired,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1);
    return { ...profile, roles: request.user.roles };
  });

  app.patch("/auth/me", { preHandler: authenticate }, async (request) => {
    const input = z
      .object({
        displayName: z.string().trim().min(2).max(80).optional(),
        locale: z.enum(["de", "en"]).optional(),
      })
      .refine((value) => Object.keys(value).length > 0)
      .parse(request.body);
    const [profile] = await db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, request.user.id))
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        locale: users.locale,
      });
    return profile;
  });

  app.get("/auth/sessions", { preHandler: authenticate }, async (request) =>
    db
      .select({
        id: sessions.id,
        deviceName: sessions.deviceName,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(eq(sessions.userId, request.user.id), isNull(sessions.revokedAt)),
      ),
  );

  app.delete(
    "/auth/sessions/:sessionId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { sessionId } = z
        .object({ sessionId: z.uuid() })
        .parse(request.params);
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(
          and(eq(sessions.id, sessionId), eq(sessions.userId, request.user.id)),
        );
      return reply.code(204).send();
    },
  );

  app.get("/auth/export", { preHandler: authenticate }, async (request) => {
    const [profile, privateDecks, privateCards, privateMedia, reviews] =
      await Promise.all([
        db
          .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            locale: users.locale,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(eq(users.id, request.user.id)),
        db.select().from(decks).where(eq(decks.ownerId, request.user.id)),
        db
          .select({ card: cards })
          .from(cards)
          .innerJoin(decks, eq(decks.id, cards.deckId))
          .where(eq(decks.ownerId, request.user.id)),
        db
          .select({
            id: media.id,
            mimeType: media.mimeType,
            byteSize: media.byteSize,
            sha256: media.sha256,
            altText: media.altText,
            createdAt: media.createdAt,
            deletedAt: media.deletedAt,
          })
          .from(media)
          .where(eq(media.ownerId, request.user.id)),
        db
          .select()
          .from(reviewEvents)
          .where(eq(reviewEvents.userId, request.user.id)),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      profile: profile[0],
      decks: privateDecks,
      cards: privateCards.map(({ card }) => card),
      media: privateMedia,
      reviewEvents: reviews,
    };
  });

  app.delete(
    "/auth/account",
    { preHandler: authenticate },
    async (request, reply) => {
      const [publishedDecks, privateMedia] = await Promise.all([
        db
          .select({ deckId: publications.deckId })
          .from(publications)
          .innerJoin(decks, eq(decks.id, publications.deckId))
          .where(eq(decks.ownerId, request.user.id)),
        db
          .select()
          .from(media)
          .where(
            and(eq(media.ownerId, request.user.id), eq(media.isPublic, false)),
          ),
      ]);
      await db.transaction(async (tx) => {
        await tx
          .delete(reviewEvents)
          .where(eq(reviewEvents.userId, request.user.id));
        await tx
          .delete(cardProgress)
          .where(eq(cardProgress.userId, request.user.id));
        await tx
          .delete(subscriptions)
          .where(eq(subscriptions.userId, request.user.id));
        await tx
          .delete(authTokens)
          .where(eq(authTokens.userId, request.user.id));
        if (privateMedia.length > 0) {
          await tx.delete(media).where(
            inArray(
              media.id,
              privateMedia.map((item) => item.id),
            ),
          );
        }
        if (publishedDecks.length === 0) {
          await tx.delete(decks).where(eq(decks.ownerId, request.user.id));
        } else {
          await tx.delete(decks).where(
            and(
              eq(decks.ownerId, request.user.id),
              notInArray(
                decks.id,
                publishedDecks.map((item) => item.deckId),
              ),
            ),
          );
        }
        await tx
          .update(users)
          .set({
            email: `deleted-${request.user.id}@invalid.local`,
            displayName: "Deleted user",
            passwordHash: "deleted",
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, request.user.id));
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(eq(sessions.userId, request.user.id));
      });
      await Promise.all(
        privateMedia.map((item) =>
          unlink(
            join(config.UPLOAD_DIRECTORY, basename(item.storageKey)),
          ).catch(() => undefined),
        ),
      );
      return reply.code(204).send();
    },
  );
};
