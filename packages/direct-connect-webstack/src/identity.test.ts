import "fake-indexeddb/auto";

import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
  registerPlugin: vi.fn(() => ({})),
}));

import {
  deleteTrustedPeer,
  getOrCreateDeviceIdentity,
  listTrustedPeers,
  saveTrustedPeer,
  signDeviceChallenge,
} from "./identity";

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("flash-n-flip-device-identity");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
});

describe("durable browser device trust", () => {
  it("keeps a signing identity and trusted reconnect peer in IndexedDB", async () => {
    const identity = await getOrCreateDeviceIdentity();
    const repeated = await getOrCreateDeviceIdentity();
    expect(repeated).toEqual(identity);
    expect(await signDeviceChallenge("reconnect-proof")).toMatch(
      /^[A-Za-z0-9+/]+=*$/,
    );

    await saveTrustedPeer({
      deviceId: "00000000-0000-4000-8000-000000000405",
      publicKey: "peer-public-key-value-that-is-long-enough",
      reconnectSecret: "A".repeat(43),
      apiOrigin: "https://flash-n-flip.com/api/",
      createdAt: "2026-08-12T10:00:00.000Z",
      updatedAt: "2026-08-12T10:00:00.000Z",
    });
    expect(await listTrustedPeers()).toMatchObject([
      {
        deviceId: "00000000-0000-4000-8000-000000000405",
        apiOrigin: "https://flash-n-flip.com/api",
      },
    ]);

    await deleteTrustedPeer("00000000-0000-4000-8000-000000000405");
    expect(await listTrustedPeers()).toEqual([]);
  });
});
