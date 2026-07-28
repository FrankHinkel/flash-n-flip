import { compare, hash } from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";

import type { Role } from "@flashcards/domain";

import type { AppConfig } from "./config.js";
import { db } from "./db/client.js";
import { sessions, userRoles, users } from "./db/schema.js";
import {
  emailMatchesAllowedDomains,
  tunnelAdminEmail,
} from "./services/auth-access-policy.js";

export type AuthUser = {
  id: string;
  email: string;
  roles: Role[];
  sessionId: string;
  tokenType: "access" | "refresh";
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export const hashPassword = (password: string): Promise<string> =>
  hash(password, 12);

export const verifyPassword = (
  password: string,
  passwordHash: string,
): Promise<boolean> => compare(password, passwordHash);

export const loadAuthUser = async (
  userId: string,
  sessionId: string,
  tokenType: AuthUser["tokenType"],
  allowedEmailDomains: string[],
): Promise<AuthUser | null> => {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!user) {
    return null;
  }

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
      ),
    )
    .limit(1);
  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  if (
    user.email !== tunnelAdminEmail &&
    !emailMatchesAllowedDomains(user.email, allowedEmailDomains)
  ) {
    return null;
  }

  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  const roles = roleRows.map((item) => item.role);

  return {
    id: user.id,
    email: user.email,
    roles,
    sessionId,
    tokenType,
  };
};

export const issueTokens = (
  app: FastifyInstance,
  config: AppConfig,
  user: Omit<AuthUser, "tokenType">,
): { accessToken: string; refreshToken: string } => ({
  accessToken: app.jwt.sign(
    { ...user, tokenType: "access" },
    { expiresIn: config.ACCESS_TOKEN_TTL },
  ),
  refreshToken: app.jwt.sign(
    { ...user, tokenType: "refresh" },
    { expiresIn: `${config.REFRESH_TOKEN_TTL_DAYS}d` },
  ),
});

export const authenticate = async (request: FastifyRequest): Promise<void> => {
  await request.jwtVerify();
  const verified = await loadAuthUser(
    request.user.id,
    request.user.sessionId,
    request.user.tokenType,
    request.server.authAccessPolicy.allowedEmailDomains,
  );
  if (!verified || verified.tokenType !== "access") {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }
  request.user = verified;
};

export const requireRole =
  (...roles: Role[]) =>
  async (request: FastifyRequest): Promise<void> => {
    await authenticate(request);
    if (!roles.some((role) => request.user.roles.includes(role))) {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
  };
