import { createHash, randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";

import { and, eq, gt, inArray, isNull, notInArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";

import {
  authenticate,
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
import {
  emailMatchesAllowedDomains,
  tunnelAdminEmail,
} from "../services/auth-access-policy.js";

const credentialsSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(12).max(128),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(80),
  locale: z.enum(["en", "de"]).default("en"),
  deviceName: z.string().trim().min(1).max(100),
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
});

const loginSchema = credentialsSchema.extend({
  deviceName: z.string().trim().min(1).max(100),
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

const createOneTimeToken = async (
  userId: string,
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD",
  validHours: number,
): Promise<string> => {
  const token = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({
    id: createId(),
    userId,
    purpose,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + validHours * 60 * 60 * 1000),
  });
  return token;
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
    if (
      !emailMatchesAllowedDomains(
        input.email,
        config.AUTH_ALLOWED_EMAIL_DOMAINS,
      )
    ) {
      return reply.code(403).send({ message: "Email domain is not allowed" });
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

  app.post("/auth/password/forgot", async (request, reply) => {
    const { email } = z
      .object({
        email: z.email().transform((value) => value.trim().toLowerCase()),
      })
      .parse(request.body);
    if (!emailMatchesAllowedDomains(email, config.AUTH_ALLOWED_EMAIL_DOMAINS)) {
      return reply.code(202).send({ accepted: true });
    }
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (user) {
      const resetToken = await createOneTimeToken(user.id, "RESET_PASSWORD", 1);
      if (config.NODE_ENV === "development") {
        return reply
          .code(202)
          .send({ accepted: true, developmentResetToken: resetToken });
      }
    }
    return reply.code(202).send({ accepted: true });
  });

  app.post("/auth/password/reset", async (request, reply) => {
    const input = z
      .object({
        token: z.string().min(32).max(200),
        password: z.string().min(12).max(128),
      })
      .parse(request.body);
    const [record] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash(input.token)),
          eq(authTokens.purpose, "RESET_PASSWORD"),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!record)
      return reply.code(400).send({ message: "Invalid or expired token" });
    const passwordHash = await hashPassword(input.password);
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, record.userId));
      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(eq(authTokens.id, record.id));
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.userId, record.userId));
    });
    return reply.code(204).send();
  });

  app.post("/auth/login", async (request, reply) => {
    const input = loginSchema.parse(request.body);
    if (
      !emailMatchesAllowedDomains(
        input.email,
        config.AUTH_ALLOWED_EMAIL_DOMAINS,
      )
    ) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }
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
    };
    return {
      user: authUser,
      ...issueTokens(app, config, authUser),
    };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const input = z
      .object({ refreshToken: z.string().min(1) })
      .parse(request.body);
    const decoded = await app.jwt.verify<AuthUser>(input.refreshToken);
    if (decoded.tokenType !== "refresh") {
      return reply.code(401).send({ message: "Invalid refresh token" });
    }
    const user = await loadAuthUser(
      decoded.id,
      decoded.sessionId,
      "refresh",
      config.AUTH_ALLOWED_EMAIL_DOMAINS,
    );
    if (!user) {
      return reply.code(401).send({ message: "Session expired" });
    }
    return issueTokens(app, config, {
      id: user.id,
      email: user.email,
      roles: user.roles,
      sessionId: user.sessionId,
    });
  });

  app.post(
    "/auth/logout",
    { preHandler: authenticate },
    async (request, reply) => {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, request.user.sessionId));
      return reply.code(204).send();
    },
  );

  app.get("/auth/me", { preHandler: authenticate }, async (request) => {
    const [profile] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        locale: users.locale,
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
