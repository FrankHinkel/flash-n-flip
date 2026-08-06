import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createId } from "@flashcards/domain";

import { buildApp } from "./app.js";
import { db } from "./db/client.js";
import { pairingSessions, users } from "./db/schema.js";

const email = `device-pairing-${Date.now()}@example.org`;
const password = "a-secure-device-pairing-password";
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

describe("authenticated device pairing", () => {
  it("pairs two owned devices, bounds signaling, and supports revocation", async () => {
    const registration = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        password,
        displayName: "Pairing Test",
        locale: "de",
        deviceName: "Login A",
        termsVersion: "test",
        privacyVersion: "test",
      },
    });
    expect(registration.statusCode, registration.body).toBe(201);
    const headers = {
      authorization: `Bearer ${registration.json().accessToken as string}`,
    };
    const deviceAId = createId();
    const deviceBId = createId();
    for (const [id, name, key] of [
      [deviceAId, "Browser A", "a".repeat(64)],
      [deviceBId, "Browser B", "b".repeat(64)],
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/devices",
        headers,
        payload: {
          id,
          displayName: name,
          platform: "WEB",
          publicKey: key,
          capabilities: ["PAIRING_V1", "WEBRTC_V1"],
        },
      });
      expect(response.statusCode, response.body).toBe(201);
      expect(response.headers["cache-control"]).toBe("no-store");
    }

    const replacedKey = await app.inject({
      method: "POST",
      url: "/devices",
      headers,
      payload: {
        id: deviceAId,
        displayName: "Browser A",
        platform: "WEB",
        publicKey: "c".repeat(64),
        capabilities: ["PAIRING_V1"],
      },
    });
    expect(replacedKey.statusCode).toBe(409);

    const created = await app.inject({
      method: "POST",
      url: "/pairing/sessions",
      headers,
      payload: {
        initiatorDeviceId: deviceAId,
        initiatorEphemeralPublicKey: "i".repeat(64),
        initiatorFingerprintProof: "p".repeat(64),
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const sessionId = created.json().id as string;

    const joined = await app.inject({
      method: "POST",
      url: `/pairing/sessions/${sessionId}/join`,
      headers,
      payload: {
        joiningDeviceId: deviceBId,
        joiningEphemeralPublicKey: "j".repeat(64),
        joiningFingerprintProof: "q".repeat(64),
      },
    });
    expect(joined.statusCode, joined.body).toBe(200);
    expect(joined.json().state).toBe("JOINED");

    const signal = await app.inject({
      method: "POST",
      url: `/pairing/sessions/${sessionId}/signals`,
      headers,
      payload: {
        senderDeviceId: deviceAId,
        recipientDeviceId: deviceBId,
        type: "OFFER",
        payload: JSON.stringify({ sdp: "opaque" }),
      },
    });
    expect(signal.statusCode, signal.body).toBe(201);
    const receivedSignals = await app.inject({
      method: "GET",
      url: `/pairing/sessions/${sessionId}/signals?deviceId=${deviceBId}&afterSequence=0`,
      headers,
    });
    expect(receivedSignals.statusCode, receivedSignals.body).toBe(200);
    expect(receivedSignals.json().signals).toHaveLength(1);

    for (const deviceId of [deviceAId, deviceBId]) {
      const confirmed = await app.inject({
        method: "POST",
        url: `/pairing/sessions/${sessionId}/confirm`,
        headers,
        payload: {
          deviceId,
          confirmationProof: "z".repeat(64),
        },
      });
      expect(confirmed.statusCode, confirmed.body).toBe(200);
    }
    const listed = await app.inject({
      method: "GET",
      url: "/devices",
      headers,
    });
    expect(listed.statusCode, listed.body).toBe(200);
    expect(listed.json().pairings).toHaveLength(1);

    const replay = await app.inject({
      method: "POST",
      url: `/pairing/sessions/${sessionId}/join`,
      headers,
      payload: {
        joiningDeviceId: deviceBId,
        joiningEphemeralPublicKey: "j".repeat(64),
        joiningFingerprintProof: "q".repeat(64),
      },
    });
    expect(replay.statusCode).toBe(409);

    const revoked = await app.inject({
      method: "DELETE",
      url: `/devices/${deviceBId}`,
      headers,
    });
    expect(revoked.statusCode).toBe(204);
    const afterRevoke = await app.inject({
      method: "GET",
      url: "/devices",
      headers,
    });
    expect(afterRevoke.json().pairings[0].revokedAt).toBeTypeOf("string");
  });

  it("expires unfinished sessions and removes their signaling window", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password, deviceName: "Expiry test" },
    });
    const headers = {
      authorization: `Bearer ${login.json().accessToken as string}`,
    };
    const listed = await app.inject({
      method: "GET",
      url: "/devices",
      headers,
    });
    const deviceId = listed.json().devices[0].id as string;
    const created = await app.inject({
      method: "POST",
      url: "/pairing/sessions",
      headers,
      payload: {
        initiatorDeviceId: deviceId,
        initiatorEphemeralPublicKey: "e".repeat(64),
        initiatorFingerprintProof: "f".repeat(64),
      },
    });
    const sessionId = created.json().id as string;
    await db
      .update(pairingSessions)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(pairingSessions.id, sessionId));
    const expired = await app.inject({
      method: "GET",
      url: `/pairing/sessions/${sessionId}?deviceId=${deviceId}`,
      headers,
    });
    expect(expired.statusCode, expired.body).toBe(200);
    expect(expired.json().state).toBe("EXPIRED");
  });
});
