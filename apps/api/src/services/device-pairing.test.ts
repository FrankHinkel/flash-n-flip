import { describe, expect, it } from "vitest";

import {
  deviceParticipatesInSession,
  effectivePairingState,
  orderedPair,
  pairingCanSignal,
} from "./device-pairing.js";

const first = "019d00de-e1f0-7528-b67d-804033433568";
const second = "019d00de-e1f0-7528-b67d-804033433569";

describe("device pairing rules", () => {
  it("orders a device pair deterministically", () => {
    expect(orderedPair(second, first)).toEqual([first, second]);
    expect(() => orderedPair(first, first)).toThrow(/itself/i);
  });

  it("expires only unfinished sessions", () => {
    const expiresAt = new Date("2026-08-06T10:00:00.000Z");
    const now = new Date("2026-08-06T10:01:00.000Z");
    expect(effectivePairingState({ state: "JOINED", expiresAt, now })).toBe(
      "EXPIRED",
    );
    expect(effectivePairingState({ state: "CONFIRMED", expiresAt, now })).toBe(
      "CONFIRMED",
    );
  });

  it("allows signaling only between both joined participants", () => {
    expect(
      pairingCanSignal({
        state: "JOINED",
        expiresAt: new Date("2026-08-06T10:05:00.000Z"),
        now: new Date("2026-08-06T10:00:00.000Z"),
        senderDeviceId: first,
        recipientDeviceId: second,
        initiatorDeviceId: first,
        joiningDeviceId: second,
      }),
    ).toBe(true);
    expect(
      pairingCanSignal({
        state: "CREATED",
        expiresAt: new Date("2026-08-06T10:05:00.000Z"),
        now: new Date("2026-08-06T10:00:00.000Z"),
        senderDeviceId: first,
        recipientDeviceId: second,
        initiatorDeviceId: first,
        joiningDeviceId: null,
      }),
    ).toBe(false);
    expect(
      pairingCanSignal({
        state: "CONFIRMED",
        expiresAt: new Date("2026-08-06T09:59:00.000Z"),
        now: new Date("2026-08-06T10:00:00.000Z"),
        senderDeviceId: first,
        recipientDeviceId: second,
        initiatorDeviceId: first,
        joiningDeviceId: second,
      }),
    ).toBe(false);
  });

  it("recognizes only explicit participants", () => {
    expect(
      deviceParticipatesInSession({
        deviceId: second,
        initiatorDeviceId: first,
        joiningDeviceId: second,
      }),
    ).toBe(true);
  });
});
