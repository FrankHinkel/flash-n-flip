import { describe, expect, it } from "vitest";

import type { Device } from "@flashcards/domain";

import { automaticConnectionPartner } from "./automatic-device-connection";

const now = new Date("2026-08-07T12:00:00.000Z");
const device = (id: string, overrides: Partial<Device> = {}): Device => ({
  id,
  displayName: id,
  platform: "WEB",
  publicKey: id.repeat(40),
  capabilities: ["WEBRTC_V1"],
  createdAt: now.toISOString(),
  lastSeenAt: now.toISOString(),
  revokedAt: null,
  ...overrides,
});

describe("automatic device connection selection", () => {
  it("pairs active devices deterministically with opposite roles", () => {
    const first = device("00000000-0000-4000-8000-000000000001");
    const second = device("00000000-0000-4000-8000-000000000002");
    const devices = [second, first];
    expect(
      automaticConnectionPartner(devices, first.id, now.getTime()),
    ).toEqual({
      device: second,
      role: "INITIATOR",
    });
    expect(
      automaticConnectionPartner(devices, second.id, now.getTime()),
    ).toEqual({
      device: first,
      role: "JOINER",
    });
  });

  it("ignores revoked, stale, and non-WebRTC devices", () => {
    const local = device("00000000-0000-4000-8000-000000000001");
    const revoked = device("00000000-0000-4000-8000-000000000002", {
      revokedAt: now.toISOString(),
    });
    const stale = device("00000000-0000-4000-8000-000000000003", {
      lastSeenAt: new Date(now.getTime() - 121_000).toISOString(),
    });
    const unsupported = device("00000000-0000-4000-8000-000000000004", {
      capabilities: ["PAIRING_V1"],
    });
    expect(
      automaticConnectionPartner(
        [local, revoked, stale, unsupported],
        local.id,
        now.getTime(),
      ),
    ).toBeNull();
  });
});
