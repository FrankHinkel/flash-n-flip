import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const app = await buildApp({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://flashcards:flashcards@127.0.0.1:5432/flashcards",
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  ALLOWED_ORIGINS: ["http://127.0.0.1:3000"],
  JWT_SECRET: "test-secret-with-at-least-thirty-two-characters",
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL_DAYS: 30,
  UPLOAD_DIRECTORY: "/private/tmp/flashcards-api-test-uploads",
  MAX_UPLOAD_BYTES: 5_242_880,
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
});
