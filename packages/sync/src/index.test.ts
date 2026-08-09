import { describe, expect, it } from "vitest";

import {
  MemorySyncStore,
  advanceReplicaWatermarks,
  createRendezvousSecrets,
  createMutation,
  decodeDirectSyncInvitation,
  decryptRendezvousSignal,
  encodeDirectSyncInvitation,
  encryptRendezvousMessage,
  latestMutableMutation,
  mergeReviewMutations,
  mutationsMissingFromReplica,
  persistPhaseOneSnapshot,
  rendezvousCapabilityHash,
  synchronize,
} from "./index";
import type { SyncTransport } from "./index";
import type { PeerMutation } from "@flashcards/domain/device-sync";

const peerMutation = (overrides: Partial<PeerMutation> = {}): PeerMutation => ({
  mutationId: "019d00de-e1f0-7528-b67d-804033433570",
  entityId: "019d00de-e1f0-7528-b67d-804033433571",
  entityType: "DECK",
  operation: "UPSERT",
  originDeviceId: "019d00de-e1f0-7528-b67d-804033433568",
  originSequence: 1,
  modifiedAt: "2026-08-06T10:00:00.000Z",
  baseVersion: 0,
  resultVersion: 1,
  payloadHash: "a".repeat(64),
  payload: { title: "Icelandic" },
  ...overrides,
});

describe("offline sync", () => {
  it("acknowledges outbox mutations and advances the cursor", async () => {
    const store = new MemorySyncStore();
    const mutation = createMutation({
      entityId: "019cfcf4-7285-7db3-936e-e652577464d8",
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: 0,
      payload: { title: "Deutsch A1" },
    });
    await store.enqueue(mutation);

    const transport: SyncTransport = {
      push: async (mutations) => ({
        acknowledged: mutations.map((item) => item.mutationId),
      }),
      pull: async () => ({ cursor: 8, changes: [] }),
    };

    await expect(synchronize(store, transport)).resolves.toBe(8);
    await expect(store.listOutbox()).resolves.toHaveLength(0);
    await expect(store.getCursor()).resolves.toBe(8);
  });

  it("applies duplicate remote mutations only once", async () => {
    const store = new MemorySyncStore();
    const mutation = createMutation({
      entityId: "019cfcf4-7285-7db3-936e-e652577464d8",
      entityType: "REVIEW",
      operation: "UPSERT",
      baseVersion: null,
      payload: { rating: "GOOD" },
    });
    const transport: SyncTransport = {
      push: async () => ({ acknowledged: [] }),
      pull: async () => ({
        cursor: 2,
        changes: [
          { cursor: 1, mutation },
          { cursor: 2, mutation },
        ],
      }),
    };

    await synchronize(store, transport);
    expect(store.applied).toHaveLength(1);
  });

  it("does not advance the cursor when local change application fails", async () => {
    const mutation = createMutation({
      entityId: "019cfcf4-7285-7db3-936e-e652577464d8",
      entityType: "REVIEW",
      operation: "UPSERT",
      baseVersion: null,
      payload: { rating: "GOOD" },
    });
    const store = new MemorySyncStore();
    store.applyRemote = async () => {
      throw new Error("simulated local transaction failure");
    };
    const transport: SyncTransport = {
      push: async () => ({ acknowledged: [] }),
      pull: async () => ({
        cursor: 3,
        changes: [{ cursor: 3, mutation }],
      }),
    };

    await expect(synchronize(store, transport)).rejects.toThrow(
      "simulated local transaction failure",
    );
    await expect(store.getCursor()).resolves.toBe(0);
  });
});

describe("peer replication", () => {
  it("sends only mutations above the remote device watermark", () => {
    const second = peerMutation({
      mutationId: "019d00de-e1f0-7528-b67d-804033433572",
      originSequence: 2,
    });
    expect(
      mutationsMissingFromReplica([peerMutation(), second], {
        [second.originDeviceId]: 1,
      }),
    ).toEqual([second]);
  });

  it("does not advance across a missing origin sequence", () => {
    const watermarks = advanceReplicaWatermarks(
      { [peerMutation().originDeviceId]: 0 },
      [peerMutation({ originSequence: 2 })],
    );
    expect(watermarks[peerMutation().originDeviceId]).toBe(0);
  });

  it("relays one origin through a three-device group without duplicates", () => {
    const first = peerMutation();
    const second = peerMutation({
      mutationId: "019d00de-e1f0-7528-b67d-804033433572",
      originSequence: 2,
    });

    const sentFromAToB = mutationsMissingFromReplica([first, second], {});
    const watermarksOnB = advanceReplicaWatermarks({}, sentFromAToB);
    expect(watermarksOnB[first.originDeviceId]).toBe(2);

    const sentFromBToC = mutationsMissingFromReplica(sentFromAToB, {});
    const watermarksOnC = advanceReplicaWatermarks({}, sentFromBToC);
    expect(sentFromBToC).toEqual([first, second]);
    expect(watermarksOnC[first.originDeviceId]).toBe(2);
    expect(mutationsMissingFromReplica(sentFromBToC, watermarksOnC)).toEqual(
      [],
    );
  });

  it("uses newest timestamp and mutation id as deterministic tie breaker", () => {
    const first = peerMutation();
    const newest = peerMutation({
      mutationId: "019d00de-e1f0-7528-b67d-804033433599",
      originSequence: 2,
      modifiedAt: "2026-08-06T10:01:00.000Z",
    });
    expect(latestMutableMutation(first, newest)).toBe(newest);
  });

  it("unions immutable review events instead of overwriting them", () => {
    const first = peerMutation({ entityType: "REVIEW" });
    const second = peerMutation({
      mutationId: "019d00de-e1f0-7528-b67d-804033433599",
      entityId: "019d00de-e1f0-7528-b67d-804033433598",
      entityType: "REVIEW",
      originSequence: 2,
      modifiedAt: "2026-08-06T10:01:00.000Z",
    });
    expect(mergeReviewMutations([first], [first, second])).toEqual([
      first,
      second,
    ]);
  });
});

describe("accountless encrypted rendezvous", () => {
  it("creates independent capabilities and hashes them like the server", async () => {
    const secrets = createRendezvousSecrets();
    expect(new Set(Object.values(secrets))).toHaveLength(3);
    await expect(rendezvousCapabilityHash("i".repeat(43))).resolves.toBe(
      "4464a7d4c9787799639ea922fdd28a7f42aac5f82aa0ccadb52ff062b2c06c32",
    );
  });

  it("round-trips a bounded invitation without leaking the initiator capability", () => {
    const invitation = {
      version: 1 as const,
      apiOrigin: "https://flash-n-flip.com/api",
      sessionId: "00000000-0000-4000-8000-000000000030",
      joinerCapability: "j".repeat(43),
      encryptionKey: "k".repeat(43),
      expiresAt: "2026-08-09T15:05:00.000Z",
    };
    const encoded = encodeDirectSyncInvitation(invitation);
    expect(encoded).not.toContain("initiatorCapability");
    expect(decodeDirectSyncInvitation(encoded)).toEqual(invitation);
  });

  it("encrypts signaling end to end and rejects ciphertext replayed under another id", async () => {
    const sessionId = "00000000-0000-4000-8000-000000000031";
    const encryptionKey = "k".repeat(43);
    const message = {
      version: 1 as const,
      messageId: "00000000-0000-4000-8000-000000000032",
      kind: "OFFER" as const,
      payload: { sdp: "private direct candidate data" },
      sentAt: "2026-08-09T15:00:00.000Z",
    };
    const encryptedPayload = await encryptRendezvousMessage({
      sessionId,
      encryptionKey,
      message,
    });
    expect(encryptedPayload).not.toContain("private");
    await expect(
      decryptRendezvousSignal({
        sessionId,
        encryptionKey,
        signal: {
          messageId: message.messageId,
          encryptedPayload,
          sequence: 1,
          createdAt: message.sentAt,
        },
      }),
    ).resolves.toEqual(message);
    await expect(
      decryptRendezvousSignal({
        sessionId,
        encryptionKey,
        signal: {
          messageId: "00000000-0000-4000-8000-000000000033",
          encryptedPayload,
          sequence: 1,
          createdAt: message.sentAt,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("phase-one durable snapshot contract", () => {
  it("validates before storage and treats duplicate delivery idempotently", async () => {
    const rows = new Map<string, unknown>();
    const store = {
      async saveSnapshot(snapshot: { transferId: string }) {
        if (rows.has(snapshot.transferId)) return "DUPLICATE" as const;
        rows.set(snapshot.transferId, snapshot);
        return "INSERTED" as const;
      },
      async loadSnapshot() {
        return null;
      },
    };
    const snapshot = {
      version: 1,
      transferId: "00000000-0000-4000-8000-000000000040",
      sentAt: "2026-08-09T15:00:00.000Z",
      deck: {
        id: "00000000-0000-4000-8000-000000000041",
        title: "Phase-1-Testdeck",
        modifiedAt: "2026-08-09T15:00:00.000Z",
        cards: [
          {
            id: "00000000-0000-4000-8000-000000000042",
            front: "Nutzdaten über den VPS?",
            back: "Nein, nur direkt per DataChannel.",
          },
        ],
      },
      review: {
        mutationId: "00000000-0000-4000-8000-000000000043",
        deckId: "00000000-0000-4000-8000-000000000041",
        cardId: "00000000-0000-4000-8000-000000000042",
        rating: "GOOD",
        reviewedAt: "2026-08-09T15:00:00.000Z",
      },
    };
    await expect(persistPhaseOneSnapshot(store, snapshot)).resolves.toBe(
      "INSERTED",
    );
    await expect(persistPhaseOneSnapshot(store, snapshot)).resolves.toBe(
      "DUPLICATE",
    );
    expect(rows).toHaveLength(1);
  });
});
