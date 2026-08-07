import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { authTokens, users } from "./db/schema.js";

const email = `password-recovery-${Date.now()}@example.org`;
const originalPassword = "original-password-123";
const changedPassword = "changed-password-456";
const recoveredPassword = "recovered-password-789";
const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:55433/flashcards",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
  JWT_SECRET: "test-secret-with-at-least-thirty-two-characters",
  FNF_DECK_MASTER_SECRET:
    "test-deck-secret-with-at-least-thirty-two-characters",
  FNF_ADMIN_ACCESS_PASSWORD: undefined,
  FNF_ADMIN_ACCESS_PASSWORD_FILE: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  UPLOAD_DIRECTORY: "/private/tmp/flashcards-api-test-uploads",
  MAX_UPLOAD_BYTES: 5_242_880,
  APKG_MAX_UPLOAD_BYTES: 104_857_600,
  FNF_MAX_PACKAGE_BYTES: 262_144_000,
  PUBLIC_REGISTRATION_ENABLED: true,
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  await app.close();
});

describe("password change and trusted-device recovery", () => {
  it("revokes other sessions and consumes a short-lived recovery code once", async () => {
    const registered = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: originalPassword,
        displayName: "Password Recovery Test",
        locale: "en",
        deviceName: "MacBook",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registered.statusCode).toBe(201);
    const userId = registered.json().user.id as string;
    const firstAccessToken = registered.json().accessToken as string;
    const firstHeaders = { authorization: `Bearer ${firstAccessToken}` };

    const secondLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: originalPassword,
        deviceName: "iPad",
      },
    });
    expect(secondLogin.statusCode).toBe(200);
    const secondHeaders = {
      authorization: `Bearer ${secondLogin.json().accessToken as string}`,
    };

    const wrongCurrentPassword = await app.inject({
      method: "POST",
      url: "/auth/password/change",
      headers: firstHeaders,
      payload: {
        currentPassword: "wrong-password",
        newPassword: changedPassword,
      },
    });
    expect(wrongCurrentPassword.statusCode).toBe(400);

    const changed = await app.inject({
      method: "POST",
      url: "/auth/password/change",
      headers: firstHeaders,
      payload: {
        currentPassword: originalPassword,
        newPassword: changedPassword,
      },
    });
    expect(changed.statusCode).toBe(204);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/auth/me",
          headers: firstHeaders,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/auth/me",
          headers: secondHeaders,
        })
      ).statusCode,
    ).toBe(401);

    const codeResponse = await app.inject({
      method: "POST",
      url: "/auth/password/recovery-code",
      headers: firstHeaders,
    });
    expect(codeResponse.statusCode).toBe(201);
    const recoveryCode = codeResponse.json().recoveryCode as string;
    expect(recoveryCode).toMatch(/^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){2}$/);
    const [storedCode] = await db
      .select({ tokenHash: authTokens.tokenHash })
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.purpose, "PASSWORD_RESET"),
        ),
      )
      .limit(1);
    expect(storedCode?.tokenHash).toHaveLength(64);
    expect(storedCode?.tokenHash).not.toBe(recoveryCode.replaceAll("-", ""));

    const invalidReset = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: {
        email,
        recoveryCode: "ABCD-EFGH-JKMN",
        newPassword: recoveredPassword,
        deviceName: "iPhone",
      },
    });
    expect(invalidReset.statusCode).toBe(400);
    expect(invalidReset.json()).toEqual({
      message: "Invalid or expired recovery code",
    });

    const reset = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: {
        email: email.toUpperCase(),
        recoveryCode: recoveryCode.toLowerCase(),
        newPassword: recoveredPassword,
        deviceName: "iPhone",
      },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().user).toMatchObject({
      email,
      passwordChangeRequired: false,
    });
    const recoveredHeaders = {
      authorization: `Bearer ${reset.json().accessToken as string}`,
    };

    expect(
      (
        await app.inject({
          method: "GET",
          url: "/auth/me",
          headers: firstHeaders,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/password/reset",
          payload: {
            email,
            recoveryCode,
            newPassword: "another-password-012",
            deviceName: "Android",
          },
        })
      ).statusCode,
    ).toBe(400);

    const recoveredLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: recoveredPassword,
        deviceName: "Android",
      },
    });
    expect(recoveredLogin.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: {
            email,
            password: changedPassword,
            deviceName: "Old MacBook",
          },
        })
      ).statusCode,
    ).toBe(401);

    const expiringCodeResponse = await app.inject({
      method: "POST",
      url: "/auth/password/recovery-code",
      headers: recoveredHeaders,
    });
    expect(expiringCodeResponse.statusCode).toBe(201);
    await db
      .update(authTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(
        and(
          eq(authTokens.userId, reset.json().user.id as string),
          eq(authTokens.purpose, "PASSWORD_RESET"),
        ),
      );
    const expiredReset = await app.inject({
      method: "POST",
      url: "/auth/password/reset",
      payload: {
        email,
        recoveryCode: expiringCodeResponse.json().recoveryCode,
        newPassword: "expired-code-password-345",
        deviceName: "Expired code test",
      },
    });
    expect(expiredReset.statusCode).toBe(400);
  });
});
