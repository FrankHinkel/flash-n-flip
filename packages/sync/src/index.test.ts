import { describe, expect, it } from "vitest";

import {
  MemorySyncStore,
  advanceReplicaWatermarks,
  createMutation,
  latestMutableMutation,
  mergeReviewMutations,
  mutationsMissingFromReplica,
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
