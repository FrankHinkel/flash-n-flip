import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createId } from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import {
  accountShareSessions,
  accountShareSignals,
  devicePairings,
  users,
} from "./db/schema.js";

const stamp = Date.now();
const senderEmail = `account-share-sender-${stamp}@example.org`;
const recipientEmail = `account-share-recipient-${stamp}@example.org`;
const password = "a-secure-account-share-password";
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

const register = async (email: string, displayName: string) => {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email,
      password,
      displayName,
      locale: "de",
      deviceName: `${displayName} login`,
      termsVersion: "test",
      privacyVersion: "test",
    },
  });
  expect(response.statusCode, response.body).toBe(201);
  return { authorization: `Bearer ${response.json().accessToken as string}` };
};

const registerDevice = async (
  headers: { authorization: string },
  id: string,
  name: string,
  key: string,
) => {
  const response = await app.inject({
    method: "POST",
    url: "/devices",
    headers,
    payload: {
      id,
      displayName: name,
      platform: "WEB",
      publicKey: key.repeat(64),
      capabilities: ["PAIRING_V1", "WEBRTC_V1", "DECK_TRANSFER_V1"],
    },
  });
  expect(response.statusCode, response.body).toBe(201);
};

afterAll(async () => {
  await db.delete(users).where(eq(users.email, senderEmail));
  await db.delete(users).where(eq(users.email, recipientEmail));
  await app.close();
});

describe("cross-account deck sharing", () => {
  it("keeps payloads peer-to-peer and never creates cross-account pairings", async () => {
    const senderHeaders = await register(senderEmail, "Alice");
    const recipientHeaders = await register(recipientEmail, "Bob");
    const senderDeviceId = createId();
    const sameAccountDeviceId = createId();
    const recipientDeviceId = createId();
    await registerDevice(senderHeaders, senderDeviceId, "Alice Mac", "a");
    await registerDevice(
      senderHeaders,
      sameAccountDeviceId,
      "Alice Phone",
      "b",
    );
    await registerDevice(recipientHeaders, recipientDeviceId, "Bob Phone", "c");
    const pairingsBefore = await db.select().from(devicePairings);

    const secret = "s".repeat(43);
    const sessionId = createId();
    const created = await app.inject({
      method: "POST",
      url: "/account-shares",
      headers: senderHeaders,
      payload: {
        id: sessionId,
        senderDeviceId,
        secretHash: createHash("sha256").update(secret).digest("hex"),
        senderEphemeralPublicKey: "p".repeat(64),
        senderFingerprintProof: "f".repeat(64),
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const [stored] = await db
      .select()
      .from(accountShareSessions)
      .where(eq(accountShareSessions.id, sessionId));
    expect(stored?.secretHash).not.toBe(secret);

    const unseenByRecipient = await app.inject({
      method: "GET",
      url: `/account-shares/${sessionId}?deviceId=${recipientDeviceId}`,
      headers: recipientHeaders,
    });
    expect(unseenByRecipient.statusCode).toBe(404);

    const sameAccountJoin = await app.inject({
      method: "POST",
      url: `/account-shares/${sessionId}/join`,
      headers: senderHeaders,
      payload: {
        recipientDeviceId: sameAccountDeviceId,
        secret,
        recipientEphemeralPublicKey: "q".repeat(64),
        recipientFingerprintProof: "g".repeat(64),
      },
    });
    expect(sameAccountJoin.statusCode).toBe(409);

    const joined = await app.inject({
      method: "POST",
      url: `/account-shares/${sessionId}/join`,
      headers: recipientHeaders,
      payload: {
        recipientDeviceId,
        secret,
        recipientEphemeralPublicKey: "r".repeat(64),
        recipientFingerprintProof: "h".repeat(64),
      },
    });
    expect(joined.statusCode, joined.body).toBe(200);
    expect(joined.json()).toMatchObject({
      state: "CLAIMED",
      senderDisplayName: "Alice",
      recipientDisplayName: "Bob",
      senderDeviceName: "Alice Mac",
      recipientDeviceName: "Bob Phone",
    });

    const confirmed = await app.inject({
      method: "POST",
      url: `/account-shares/${sessionId}/confirm`,
      headers: senderHeaders,
      payload: { senderDeviceId },
    });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json().state).toBe("CONFIRMED");

    const signal = await app.inject({
      method: "POST",
      url: `/account-shares/${sessionId}/signals`,
      headers: senderHeaders,
      payload: {
        senderDeviceId,
        recipientDeviceId,
        type: "OFFER",
        payload: JSON.stringify({ sdp: "opaque only" }),
      },
    });
    expect(signal.statusCode, signal.body).toBe(201);
    const received = await app.inject({
      method: "GET",
      url: `/account-shares/${sessionId}/signals?deviceId=${recipientDeviceId}&afterSequence=0`,
      headers: recipientHeaders,
    });
    expect(received.statusCode, received.body).toBe(200);
    expect(received.json().signals).toHaveLength(1);

    const completed = await app.inject({
      method: "POST",
      url: `/account-shares/${sessionId}/complete`,
      headers: recipientHeaders,
      payload: { recipientDeviceId },
    });
    expect(completed.statusCode, completed.body).toBe(200);
    expect(completed.json().state).toBe("COMPLETED");
    expect(
      await db
        .select()
        .from(accountShareSignals)
        .where(eq(accountShareSignals.sessionId, sessionId)),
    ).toHaveLength(0);
    expect(await db.select().from(devicePairings)).toHaveLength(
      pairingsBefore.length,
    );
  });
});
