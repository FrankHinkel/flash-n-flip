import { describe, expect, it } from "vitest";

import {
  createRendezvousSessionSchema,
  createRendezvousSignalSchema,
  rendezvousCapabilitySchema,
  rendezvousSignalsQuerySchema,
} from "./rendezvous.js";

const hash = (character: string) => character.repeat(64);

describe("accountless rendezvous contracts", () => {
  it("accepts a platform-neutral version negotiation envelope", () => {
    expect(
      createRendezvousSessionSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        supportedProtocolVersions: [1],
        initiatorCapabilityHash: hash("a"),
        joinerCapabilityHash: hash("b"),
      }),
    ).toMatchObject({ supportedProtocolVersions: [1] });
  });

  it("requires independent role capabilities", () => {
    expect(() =>
      createRendezvousSessionSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        supportedProtocolVersions: [1],
        initiatorCapabilityHash: hash("a"),
        joinerCapabilityHash: hash("a"),
      }),
    ).toThrow();
  });

  it("bounds capabilities and opaque encrypted signals", () => {
    expect(rendezvousCapabilitySchema.safeParse("a".repeat(43)).success).toBe(
      true,
    );
    expect(rendezvousCapabilitySchema.safeParse("too short").success).toBe(
      false,
    );
    expect(
      createRendezvousSignalSchema.safeParse({
        messageId: "00000000-0000-4000-8000-000000000002",
        encryptedPayload: "A".repeat(65_537),
      }).success,
    ).toBe(false);
  });

  it("defaults signal polling to the beginning of a short-lived session", () => {
    expect(rendezvousSignalsQuerySchema.parse({})).toEqual({
      afterSequence: 0,
    });
  });
});
