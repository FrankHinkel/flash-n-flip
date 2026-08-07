import { describe, expect, it } from "vitest";

import {
  accountShareQrPayloadSchema,
  createAccountShareSessionSchema,
  joinAccountShareSessionSchema,
} from "./account-share.js";

const firstId = "019fdbc4-e52b-706b-ad54-9b8c051828d6";
const secondId = "019fdbc4-e52b-706b-ad54-9b8c051828d7";

describe("account share contracts", () => {
  it("requires an opaque high-entropy QR secret", () => {
    const payload = accountShareQrPayloadSchema.parse({
      version: 1,
      serverOrigin: "https://flash-n-flip.test",
      sessionId: firstId,
      secret: "a".repeat(43),
      senderDeviceId: secondId,
      senderEphemeralPublicKey: "p".repeat(32),
    });
    expect(payload.secret).toHaveLength(43);
    expect(() =>
      accountShareQrPayloadSchema.parse({ ...payload, secret: "short" }),
    ).toThrow();
  });

  it("validates only a secret digest at creation and the secret at claim", () => {
    expect(
      createAccountShareSessionSchema.parse({
        id: firstId,
        senderDeviceId: secondId,
        secretHash: "a".repeat(64),
        senderEphemeralPublicKey: "p".repeat(32),
        senderFingerprintProof: "f".repeat(32),
      }).secretHash,
    ).toHaveLength(64);
    expect(
      joinAccountShareSessionSchema.parse({
        recipientDeviceId: secondId,
        secret: "s".repeat(43),
        recipientEphemeralPublicKey: "p".repeat(32),
        recipientFingerprintProof: "f".repeat(32),
      }).secret,
    ).toHaveLength(43);
  });
});
