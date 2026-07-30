import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";

const email = `deck-language-${Date.now()}@example.org`;
const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:55432/flashcards",
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

describe("deck language direction flow", () => {
  it("defaults one language to both sides and persists a corrected target", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password: "a-secure-test-password",
        displayName: "Deck Language Test",
        locale: "de",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode).toBe(201);
    const headers = {
      authorization: `Bearer ${registration.json().accessToken as string}`,
    };

    const created = await app.inject({
      method: "POST",
      url: "/decks",
      headers,
      payload: {
        title: "Spanische Karten",
        language: "de",
        contentLocales: ["de"],
        defaultContentLocale: "de",
        sourceLocale: "es",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      sourceLocale: "es",
      targetLocale: "es",
    });

    const updated = await app.inject({
      method: "PATCH",
      url: `/decks/${created.json().id as string}`,
      headers,
      payload: {
        targetLocale: "de",
        version: created.json().version,
      },
    });
    expect(updated.statusCode).toBe(200);

    const reopened = await app.inject({
      method: "GET",
      url: `/decks/${created.json().id as string}`,
      headers,
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json()).toMatchObject({
      sourceLocale: "es",
      targetLocale: "de",
    });
  });
});
