import { describe, expect, it } from "vitest";

import {
  pairingQrPayloadSchema,
  pairingSignalSchema,
  peerMutationSchema,
  peerTransferManifestSchema,
} from "./device-sync";

const ids = {
  session: "019d00de-e1f0-7528-b67d-804033433567",
  sender: "019d00de-e1f0-7528-b67d-804033433568",
  receiver: "019d00de-e1f0-7528-b67d-804033433569",
  mutation: "019d00de-e1f0-7528-b67d-804033433570",
  entity: "019d00de-e1f0-7528-b67d-804033433571",
  transfer: "019d00de-e1f0-7528-b67d-804033433572",
  deck: "019d00de-e1f0-7528-b67d-804033433573",
};

describe("device and peer schemas", () => {
  it("keeps the QR secret bounded and out of a server query model", () => {
    const parsed = pairingQrPayloadSchema.parse({
      version: 1,
      serverOrigin: "https://flash-n-flip.com",
      sessionId: ids.session,
      secret: "a".repeat(43),
      initiatorDeviceId: ids.sender,
      initiatorEphemeralPublicKey: "public-key".repeat(4),
    });
    expect(parsed.secret).toHaveLength(43);
    expect(() =>
      pairingQrPayloadSchema.parse({ ...parsed, secret: "short" }),
    ).toThrow();
  });

  it("limits signaling payloads", () => {
    const signal = {
      id: ids.entity,
      sessionId: ids.session,
      senderDeviceId: ids.sender,
      recipientDeviceId: ids.receiver,
      sequence: 1,
      type: "OFFER",
      payload: "x".repeat(48 * 1024),
      createdAt: new Date().toISOString(),
    } as const;
    expect(pairingSignalSchema.parse(signal).payload).toHaveLength(48 * 1024);
    expect(() =>
      pairingSignalSchema.parse({ ...signal, payload: `${signal.payload}x` }),
    ).toThrow();
  });

  it("requires deterministic peer ordering fields", () => {
    expect(
      peerMutationSchema.parse({
        mutationId: ids.mutation,
        entityId: ids.entity,
        entityType: "DECK",
        operation: "UPSERT",
        originDeviceId: ids.sender,
        originSequence: 1,
        modifiedAt: new Date().toISOString(),
        baseVersion: 0,
        resultVersion: 1,
        payloadHash: "a".repeat(64),
        payload: { title: "Icelandic" },
      }).originSequence,
    ).toBe(1);
  });

  it("rejects transfer manifests whose totals are not bounded numbers", () => {
    const manifest = {
      version: 1,
      transferId: ids.transfer,
      kind: "DECK_COPY",
      senderDeviceId: ids.sender,
      rootDeckIds: [ids.deck],
      deckCount: 1,
      cardCount: 400,
      noteCount: 200,
      mediaCount: 0,
      totalBytes: 1000,
      chunkSize: 256 * 1024,
      includesLearningProgress: false,
      manifestPayloadHash: "b".repeat(64),
      media: [],
      createdAt: new Date().toISOString(),
    } as const;
    expect(peerTransferManifestSchema.parse(manifest).cardCount).toBe(400);
    expect(() =>
      peerTransferManifestSchema.parse({ ...manifest, totalBytes: -1 }),
    ).toThrow();
  });
});
