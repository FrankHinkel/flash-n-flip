import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:5432/flashcards",
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
  PUBLIC_REGISTRATION_ENABLED: false,
});

afterAll(async () => app.close());

describe("API", () => {
  it("reports health without leaking internals", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      version: "1.0.0-rc.0",
    });
  });

  it("rejects invalid registration before database access", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "invalid" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects public registration before database access", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "frank@example.com",
        password: "a-secure-test-password",
        displayName: "Frank",
        locale: "de",
        deviceName: "API test",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ message: "Registration is disabled" });
  });

  it("rejects malformed login before database access", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "invalid",
        password: "a-secure-test-password",
        deviceName: "API test",
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("requires authentication for community data", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/community/decks",
    });
    expect(response.statusCode).toBe(401);
  });

  it.each(["PATCH", "DELETE"])(
    "allows browser preflight for %s mutations",
    async (method) => {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/decks/00000000-0000-4000-8000-000000000000",
        headers: {
          origin: "http://127.0.0.1:3000",
          "access-control-request-method": method,
          "access-control-request-headers": "authorization,content-type",
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:3000",
      );
      expect(response.headers["access-control-allow-methods"]).toContain(
        method,
      );
    },
  );
});
