import "fake-indexeddb/auto";

import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { closeOfflineDatabase, clearOfflineData } from "./offline";
import {
  createPairingSecret,
  decodePairingPayload,
  encodePairingPayload,
  getOrCreateLocalDeviceIdentity,
  pairingConfirmationCode,
  pairingProof,
  recommendedDeviceName,
} from "./device-identity";

Object.defineProperty(globalThis, "crypto", {
  configurable: true,
  value: webcrypto,
});

afterEach(async () => {
  await clearOfflineData();
  await closeOfflineDatabase();
});

describe("local device identity", () => {
  it("persists a non-extractable private key across a database reopen", async () => {
    const first = await getOrCreateLocalDeviceIdentity();
    expect(first.privateKey.extractable).toBe(false);
    await closeOfflineDatabase();
    const restored = await getOrCreateLocalDeviceIdentity();
    expect(restored.id).toBe(first.id);
    expect(restored.publicKey).toBe(first.publicKey);
  });

  it("keeps the high-entropy secret in the QR fragment", () => {
    const secret = createPairingSecret();
    const value = encodePairingPayload({
      version: 1,
      serverOrigin: "https://flash-n-flip.com",
      sessionId: "019d00de-e1f0-7528-b67d-804033433567",
      secret,
      initiatorDeviceId: "019d00de-e1f0-7528-b67d-804033433568",
      initiatorEphemeralPublicKey: "public-key".repeat(4),
    });
    expect(new URL(value).search).toBe("");
    expect(decodePairingPayload(value).secret).toBe(secret);
  });

  it("derives matching proofs and a stable six-digit confirmation", async () => {
    const secret = createPairingSecret();
    await expect(pairingProof(secret, "fingerprint")).resolves.toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    await expect(
      pairingConfirmationCode(secret, "b-public", "a-public"),
    ).resolves.toMatch(/^\d{6}$/);
  });

  it("suggests concise names without claiming native LAN capabilities", () => {
    expect(
      recommendedDeviceName({
        platform: "WEB",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      }),
    ).toBe("iPhone");
    expect(
      recommendedDeviceName({
        platform: "WEB",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 5,
      }),
    ).toBe("iPad");
    expect(
      recommendedDeviceName({
        platform: "WEB",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      }),
    ).toBe("Mac");
    expect(
      recommendedDeviceName({
        platform: "WEB",
        userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
      }),
    ).toBe("Android");
  });
});
