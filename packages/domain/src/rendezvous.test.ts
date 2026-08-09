import { describe, expect, it } from "vitest";

import {
  createRendezvousSessionSchema,
  createRendezvousSignalSchema,
  directSyncInvitationSchema,
  phaseOneSnapshotSchema,
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

  it("accepts only secure cross-platform direct-sync invitations", () => {
    const invitation = {
      version: 1,
      apiOrigin: "https://flash-n-flip.com/api",
      sessionId: "00000000-0000-4000-8000-000000000010",
      joinerCapability: "j".repeat(43),
      encryptionKey: "k".repeat(43),
      expiresAt: "2026-08-09T15:05:00.000Z",
    };
    expect(directSyncInvitationSchema.parse(invitation)).toEqual(invitation);
    expect(() =>
      directSyncInvitationSchema.parse({
        ...invitation,
        apiOrigin: "http://flash-n-flip.com/api",
      }),
    ).toThrow(/https/i);
  });

  it("binds a phase-one review to a card in the transferred deck", () => {
    const snapshot = {
      version: 1,
      transferId: "00000000-0000-4000-8000-000000000020",
      sentAt: "2026-08-09T15:00:00.000Z",
      deck: {
        id: "00000000-0000-4000-8000-000000000021",
        title: "Phase-1-Testdeck",
        modifiedAt: "2026-08-09T15:00:00.000Z",
        cards: [
          {
            id: "00000000-0000-4000-8000-000000000022",
            front: "Direkter Transport?",
            back: "WebRTC DataChannel",
          },
        ],
      },
      review: {
        mutationId: "00000000-0000-4000-8000-000000000023",
        deckId: "00000000-0000-4000-8000-000000000021",
        cardId: "00000000-0000-4000-8000-000000000022",
        rating: "GOOD",
        reviewedAt: "2026-08-09T15:00:00.000Z",
      },
    } as const;
    expect(phaseOneSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() =>
      phaseOneSnapshotSchema.parse({
        ...snapshot,
        review: {
          ...snapshot.review,
          cardId: "00000000-0000-4000-8000-000000000099",
        },
      }),
    ).toThrow(/card/i);
  });
});
