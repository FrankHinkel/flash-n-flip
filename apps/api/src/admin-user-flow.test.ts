import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { auditEvents, users } from "./db/schema.js";

const adminPassword = "test-admin-access-password-with-32-characters";
const email = `invited-${Date.now()}@example.org`;
const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:55432/flashcards",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
  JWT_SECRET: "test-secret-with-at-least-thirty-two-characters",
  FNF_DECK_MASTER_SECRET:
    "test-deck-secret-with-at-least-thirty-two-characters",
  FNF_ADMIN_ACCESS_PASSWORD: adminPassword,
  FNF_ADMIN_ACCESS_PASSWORD_FILE: undefined,
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  UPLOAD_DIRECTORY: "/private/tmp/flashcards-api-test-uploads",
  MAX_UPLOAD_BYTES: 5_242_880,
  APKG_MAX_UPLOAD_BYTES: 104_857_600,
  FNF_MAX_PACKAGE_BYTES: 262_144_000,
  PUBLIC_REGISTRATION_ENABLED: false,
});

afterAll(async () => {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (user) {
    await db
      .delete(auditEvents)
      .where(
        and(
          eq(auditEvents.entityType, "USER"),
          eq(auditEvents.entityId, user.id),
        ),
      );
  }
  await db.delete(users).where(eq(users.email, email));
  await app.close();
});

describe("admin-created user flow", () => {
  it("requires a password change after account creation and reset", async () => {
    const adminLogin = await app.inject({
      method: "POST",
      url: "/auth/admin-access",
      payload: {
        accessPassword: adminPassword,
        deviceName: "Admin test",
      },
    });
    expect(adminLogin.statusCode).toBe(200);
    const adminAccessToken = adminLogin.json().accessToken as string;
    const adminHeaders = { authorization: `Bearer ${adminAccessToken}` };

    const invalidPin = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: adminHeaders,
      payload: {
        email,
        displayName: "Invited User",
        locale: "en",
        temporaryPassword: "12345",
      },
    });
    expect(invalidPin.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: "/admin/users",
      headers: adminHeaders,
      payload: {
        email,
        displayName: "Invited User",
        locale: "en",
        temporaryPassword: "123456",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      email,
      passwordChangeRequired: true,
    });

    const pinLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: "123456",
        deviceName: "Invited test",
      },
    });
    expect(pinLogin.statusCode).toBe(200);
    expect(pinLogin.json().user.passwordChangeRequired).toBe(true);
    const pinAccessToken = pinLogin.json().accessToken as string;
    const pinHeaders = { authorization: `Bearer ${pinAccessToken}` };

    const blocked = await app.inject({
      method: "GET",
      url: "/decks",
      headers: pinHeaders,
    });
    expect(blocked.statusCode).toBe(428);
    expect(blocked.json()).toEqual({ message: "Password change required" });

    const changed = await app.inject({
      method: "POST",
      url: "/auth/password/change-required",
      headers: pinHeaders,
      payload: {
        newPassword: "a-personal-password-123",
        termsAccepted: true,
        privacyAcknowledged: true,
        locale: "en",
      },
    });
    expect(changed.statusCode).toBe(204);

    const unblocked = await app.inject({
      method: "GET",
      url: "/decks",
      headers: pinHeaders,
    });
    expect(unblocked.statusCode).toBe(200);

    const reset = await app.inject({
      method: "POST",
      url: "/admin/users/password-reset",
      headers: adminHeaders,
      payload: { email, temporaryPassword: "654321" },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().passwordChangeRequired).toBe(true);

    const revoked = await app.inject({
      method: "GET",
      url: "/decks",
      headers: pinHeaders,
    });
    expect(revoked.statusCode).toBe(401);

    const resetPinLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: "654321",
        deviceName: "Reset test",
      },
    });
    expect(resetPinLogin.statusCode).toBe(200);
    expect(resetPinLogin.json().user.passwordChangeRequired).toBe(true);
  });
});
