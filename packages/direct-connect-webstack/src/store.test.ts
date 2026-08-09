import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { PhaseOneSnapshot } from "@flashcards/domain/rendezvous";

import { IndexedDbPhaseOneStore, NativeSqlitePhaseOneStore } from "./store";

const snapshot = (): PhaseOneSnapshot => ({
  version: 1,
  transferId: "00000000-0000-4000-8000-000000000050",
  sentAt: "2026-08-09T15:00:00.000Z",
  deck: {
    id: "00000000-0000-4000-8000-000000000051",
    title: "Phase-1-Testdeck",
    modifiedAt: "2026-08-09T15:00:00.000Z",
    cards: [
      {
        id: "00000000-0000-4000-8000-000000000052",
        front: "Direkt?",
        back: "Ja.",
      },
    ],
  },
  review: {
    mutationId: "00000000-0000-4000-8000-000000000053",
    deckId: "00000000-0000-4000-8000-000000000051",
    cardId: "00000000-0000-4000-8000-000000000052",
    rating: "GOOD",
    reviewedAt: "2026-08-09T15:00:00.000Z",
  },
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("flash-n-flip-phase-one");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
});

describe("phase-one IndexedDB persistence", () => {
  it("survives a new repository instance and ignores duplicate delivery", async () => {
    const firstProcess = new IndexedDbPhaseOneStore();
    await expect(firstProcess.saveSnapshot(snapshot())).resolves.toBe(
      "INSERTED",
    );
    await expect(firstProcess.saveSnapshot(snapshot())).resolves.toBe(
      "DUPLICATE",
    );

    const restartedProcess = new IndexedDbPhaseOneStore();
    await expect(restartedProcess.loadSnapshot()).resolves.toEqual(snapshot());
  });
});

describe("phase-one native SQLite persistence", () => {
  it("passes an explicit empty values array for parameterless queries", async () => {
    const query = vi.fn().mockResolvedValue({ values: [] });
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      run: vi.fn(),
      query,
    };

    await expect(
      new NativeSqlitePhaseOneStore(sqlite).loadSnapshot(),
    ).resolves.toBeNull();
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ values: [] }));
  });
});
