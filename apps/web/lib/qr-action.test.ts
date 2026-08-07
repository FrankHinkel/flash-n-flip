import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { toQR } from "toqr";

import { encodeAccountShareLink } from "./account-share-link";
import { encodePairingPayload } from "./device-identity";
import { decodeFlashNFlipQrAction } from "./qr-action";

const origin = "https://flash-n-flip.test";
const share = {
  version: 1 as const,
  serverOrigin: origin,
  sessionId: "019fdbc4-e52b-706b-ad54-9b8c051828d6",
  secret: "s".repeat(43),
  senderDeviceId: "019fdbc4-e52b-706b-ad54-9b8c051828d7",
  senderEphemeralPublicKey: "p".repeat(64),
};
const pairing = {
  version: 1 as const,
  serverOrigin: origin,
  sessionId: "019fdbc4-e52b-706b-ad54-9b8c051828d8",
  secret: "q".repeat(43),
  initiatorDeviceId: "019fdbc4-e52b-706b-ad54-9b8c051828d9",
  initiatorEphemeralPublicKey: "k".repeat(64),
};

describe("Flash-n-Flip QR action dispatcher", () => {
  it("routes account-share and device-pairing links by their validated schema", () => {
    expect(
      decodeFlashNFlipQrAction(encodeAccountShareLink(share), origin),
    ).toEqual({ kind: "ACCOUNT_SHARE", invitation: share });
    expect(
      decodeFlashNFlipQrAction(encodePairingPayload(pairing), origin),
    ).toEqual({ kind: "DEVICE_PAIRING", invitation: pairing });
  });

  it("also accepts copied fragment values", () => {
    const link = new URL(encodeAccountShareLink(share));
    expect(decodeFlashNFlipQrAction(link.hash.slice(1), origin).kind).toBe(
      "ACCOUNT_SHARE",
    );
  });

  it("decodes a real generated Flash-n-Flip QR image", () => {
    const link = encodeAccountShareLink(share);
    const modules = toQR(link);
    const side = Math.sqrt(modules.length);
    const quietZone = 4;
    const scale = 5;
    const imageSide = (side + quietZone * 2) * scale;
    const pixels = new Uint8ClampedArray(imageSide * imageSide * 4).fill(255);
    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
      if (modules[moduleIndex] !== 1) continue;
      const moduleX = (moduleIndex % side) + quietZone;
      const moduleY = Math.floor(moduleIndex / side) + quietZone;
      for (let y = moduleY * scale; y < (moduleY + 1) * scale; y += 1) {
        for (let x = moduleX * scale; x < (moduleX + 1) * scale; x += 1) {
          const pixel = (y * imageSide + x) * 4;
          pixels[pixel] = 0;
          pixels[pixel + 1] = 0;
          pixels[pixel + 2] = 0;
        }
      }
    }
    const decoded = jsQR(pixels, imageSide, imageSide, {
      inversionAttempts: "attemptBoth",
    });
    expect(decoded?.data).toBe(link);
    expect(decodeFlashNFlipQrAction(decoded!.data, origin).kind).toBe(
      "ACCOUNT_SHARE",
    );
  });

  it("rejects foreign, ambiguous, malformed, and oversized values", () => {
    const shareLink = new URL(encodeAccountShareLink(share));
    expect(() =>
      decodeFlashNFlipQrAction(
        `https://evil.example/app/decks${shareLink.hash}`,
        origin,
      ),
    ).toThrow(/another server/);
    expect(() =>
      decodeFlashNFlipQrAction(
        `${encodeAccountShareLink(share)}&pair=${"a".repeat(80)}`,
        origin,
      ),
    ).toThrow(/more than one action/);
    expect(() =>
      decodeFlashNFlipQrAction("javascript:alert(1)", origin),
    ).toThrow(/not a supported/);
    expect(() => decodeFlashNFlipQrAction("x".repeat(8_193), origin)).toThrow(
      /too large/,
    );
  });

  it("rejects a valid payload that names another signaling server", () => {
    const foreign = encodeAccountShareLink({
      ...share,
      serverOrigin: "https://foreign.example",
    });
    const disguised = `${origin}/app/decks${new URL(foreign).hash}`;
    expect(() => decodeFlashNFlipQrAction(disguised, origin)).toThrow(
      /another server/,
    );
  });
});
