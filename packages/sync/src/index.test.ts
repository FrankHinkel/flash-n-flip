import { describe, expect, it } from "vitest";

import { MemorySyncStore, createMutation, synchronize } from "./index";
import type { SyncTransport } from "./index";

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
});
