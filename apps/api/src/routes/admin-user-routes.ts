import { asc, and, eq, isNull, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";

import { hashPassword, requireRole } from "../auth.js";
import { db } from "../db/client.js";
import { auditEvents, sessions, userRoles, users } from "../db/schema.js";
import { tunnelAdminEmail } from "../services/auth-access-policy.js";

const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

const userResponse = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  locale: users.locale,
  passwordChangeRequired: users.passwordChangeRequired,
  createdAt: users.createdAt,
};

export const registerAdminUserRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/admin/users", { preHandler: requireRole("ADMIN") }, async () =>
    db
      .select(userResponse)
      .from(users)
      .where(and(isNull(users.deletedAt), ne(users.email, tunnelAdminEmail)))
      .orderBy(asc(users.email)),
  );

  app.post(
    "/admin/users",
    {
      preHandler: requireRole("ADMIN"),
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const input = z
        .object({
          email: emailSchema,
          displayName: z.string().trim().min(2).max(80),
          locale: z.enum(["en", "de", "es", "fr"]).default("en"),
          temporaryPassword: z.string().regex(/^\d{6}$/),
        })
        .parse(request.body);
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (existing) {
        return reply.code(409).send({ message: "Account already exists" });
      }

      const id = createId();
      const passwordHash = await hashPassword(input.temporaryPassword);
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id,
          email: input.email,
          displayName: input.displayName,
          locale: input.locale,
          passwordHash,
          passwordChangeRequired: true,
        });
        await tx.insert(userRoles).values([
          { userId: id, role: "USER" },
          { userId: id, role: "AUTHOR" },
        ]);
        await tx.insert(auditEvents).values({
          id: createId(),
          actorId: request.user.id,
          action: "account.created",
          entityType: "USER",
          entityId: id,
          reason: "Invited account created",
          metadata: { locale: input.locale, roles: ["USER", "AUTHOR"] },
        });
      });
      const [created] = await db
        .select(userResponse)
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return reply.code(201).send(created);
    },
  );

  app.post(
    "/admin/users/password-reset",
    {
      preHandler: requireRole("ADMIN"),
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const input = z
        .object({
          email: emailSchema,
          temporaryPassword: z.string().regex(/^\d{6}$/),
        })
        .parse(request.body);
      const passwordHash = await hashPassword(input.temporaryPassword);
      const updated = await db.transaction(async (tx) => {
        const [account] = await tx
          .update(users)
          .set({
            passwordHash,
            passwordChangeRequired: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(users.email, input.email),
              ne(users.email, tunnelAdminEmail),
              isNull(users.deletedAt),
            ),
          )
          .returning(userResponse);
        if (!account) return null;
        await tx
          .update(sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(eq(sessions.userId, account.id), isNull(sessions.revokedAt)),
          );
        await tx.insert(auditEvents).values({
          id: createId(),
          actorId: request.user.id,
          action: "account.password_reset",
          entityType: "USER",
          entityId: account.id,
          reason: "Administrator issued a new start PIN",
          metadata: { sessionsRevoked: true },
        });
        return account;
      });
      if (!updated) {
        return reply.code(404).send({ message: "Account not found" });
      }
      return updated;
    },
  );
};
