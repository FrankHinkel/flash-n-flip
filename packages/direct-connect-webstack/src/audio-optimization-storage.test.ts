import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { IndexedDbAudioOptimizationStorage } from "./audio-optimization-storage";
import { webLocalAuthorityDatabaseName } from "./local-authority-storage";

const deleteDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

afterEach(deleteDatabase);

describe("durable browser audio optimization queue", () => {
  it("survives a storage instance restart", async () => {
    const first = new IndexedDbAudioOptimizationStorage();
    await first.put({
      mediaId: "00000000-0000-4000-8000-000000000011",
      status: "PROCESSING",
      checkpoint: "PCM_READY",
      attempts: 1,
      originalBytes: 1_000,
      optimizedBytes: 0,
      potentialSavedBytes: 0,
      updatedAt: "2026-08-11T12:00:00.000Z",
    });

    const restarted = new IndexedDbAudioOptimizationStorage();
    expect(await restarted.list()).toEqual([
      expect.objectContaining({
        status: "PROCESSING",
        checkpoint: "PCM_READY",
      }),
    ]);
  });

  it("deletes a large set of stale jobs in one storage operation", async () => {
    const storage = new IndexedDbAudioOptimizationStorage();
    const mediaIds = Array.from(
      { length: 450 },
      (_, index) =>
        `00000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
    );
    for (const mediaId of mediaIds) {
      await storage.put({
        mediaId,
        status: "COMPLETE",
        checkpoint: "COMPARISON_READY",
        attempts: 1,
        pipelineVersion: 4,
        originalBytes: 10,
        optimizedBytes: 5,
        potentialSavedBytes: 5,
        updatedAt: "2026-08-17T12:00:00.000Z",
      });
    }

    await storage.deleteMany(mediaIds.slice(0, 400));

    await expect(storage.list()).resolves.toHaveLength(50);
  });
});
