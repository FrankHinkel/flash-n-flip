import { describe, expect, it } from "vitest";

import {
  decodeAccountShareLink,
  encodeAccountShareLink,
  sha256Hex,
} from "./account-share-link";

const payload = {
  version: 1 as const,
  serverOrigin: "https://flash-n-flip.test",
  sessionId: "019fdbc4-e52b-706b-ad54-9b8c051828d6",
  secret: "s".repeat(43),
  senderDeviceId: "019fdbc4-e52b-706b-ad54-9b8c051828d7",
  senderEphemeralPublicKey: "p".repeat(64),
};

describe("account share links", () => {
  it("keeps the invitation in the URL fragment and round-trips it", () => {
    const link = encodeAccountShareLink(payload);
    expect(new URL(link).search).toBe("");
    expect(new URL(link).hash).toMatch(/^#share=/);
    expect(link).not.toContain(payload.secret);
    expect(decodeAccountShareLink(link)).toEqual(payload);
  });

  it("hashes the secret without storing its clear text", async () => {
    const hash = await sha256Hex(payload.secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(payload.secret);
  });
});
