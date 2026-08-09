import { createHash } from "node:crypto";

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
  UPLOAD_DIRECTORY: "/private/tmp/flashcards-rendezvous-test-uploads",
  MAX_UPLOAD_BYTES: 5_242_880,
  APKG_MAX_UPLOAD_BYTES: 104_857_600,
  FNF_MAX_PACKAGE_BYTES: 262_144_000,
  PUBLIC_REGISTRATION_ENABLED: false,
});

afterAll(async () => app.close());

const initiatorCapability = "i".repeat(43);
const joinerCapability = "j".repeat(43);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const sessionId = "00000000-0000-4000-8000-000000000020";

describe("accountless rendezvous API", () => {
  it("negotiates, joins and relays only opaque idempotent signals", async () => {
    const compatibility = await app.inject({
      method: "GET",
      url: "/rendezvous/v1/compatibility",
    });
    expect(compatibility.statusCode).toBe(200);
    expect(compatibility.json().supportedProtocolVersions).toEqual([1]);

    const created = await app.inject({
      method: "POST",
      url: "/rendezvous/v1/sessions",
      payload: {
        id: sessionId,
        supportedProtocolVersions: [1],
        initiatorCapabilityHash: hash(initiatorCapability),
        joinerCapabilityHash: hash(joinerCapability),
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      id: sessionId,
      protocolVersion: 1,
      state: "CREATED",
    });
    expect(created.headers["cache-control"]).toBe("no-store");

    const joined = await app.inject({
      method: "POST",
      url: `/rendezvous/v1/sessions/${sessionId}/join`,
      headers: { authorization: `Rendezvous ${joinerCapability}` },
    });
    expect(joined.statusCode).toBe(200);
    expect(joined.json().state).toBe("JOINED");

    const message = {
      messageId: "00000000-0000-4000-8000-000000000021",
      encryptedPayload: "opaque_ciphertext",
    };
    const sent = await app.inject({
      method: "POST",
      url: `/rendezvous/v1/sessions/${sessionId}/signals`,
      headers: { authorization: `Rendezvous ${initiatorCapability}` },
      payload: message,
    });
    const retried = await app.inject({
      method: "POST",
      url: `/rendezvous/v1/sessions/${sessionId}/signals`,
      headers: { authorization: `Rendezvous ${initiatorCapability}` },
      payload: message,
    });
    expect(sent.statusCode).toBe(201);
    expect(retried.json().sequence).toBe(sent.json().sequence);

    const senderPoll = await app.inject({
      method: "GET",
      url: `/rendezvous/v1/sessions/${sessionId}/signals`,
      headers: { authorization: `Rendezvous ${initiatorCapability}` },
    });
    expect(senderPoll.json()).toEqual({ signals: [] });

    const receiverPoll = await app.inject({
      method: "GET",
      url: `/rendezvous/v1/sessions/${sessionId}/signals?afterSequence=0`,
      headers: { authorization: `Rendezvous ${joinerCapability}` },
    });
    expect(receiverPoll.json().signals).toEqual([sent.json()]);
  });

  it("does not disclose a session for a wrong capability", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/rendezvous/v1/sessions/${sessionId}`,
      headers: { authorization: `Rendezvous ${"x".repeat(43)}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
