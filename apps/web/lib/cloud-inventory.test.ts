import { describe, expect, it, vi } from "vitest";

import {
  CloudInventoryError,
  cloudInventoryMaximumRequests,
  mergeCloudInventoryDecks,
  readBoundedCloudInventory,
  type CloudInventoryRecord,
} from "./cloud-inventory";

const deckA = "11111111-1111-4111-8111-111111111111";
const deckB = "22222222-2222-4222-8222-222222222222";
const payloadA = `payload.${"a".repeat(64)}`;
const payloadB = `payload.${"b".repeat(64)}`;

function record(
  recordName: string,
  value: unknown,
): CloudInventoryRecord {
  return { recordName, value };
}

function fixture() {
  const records = new Map<string, CloudInventoryRecord>([
    [
      "library.root.v3",
      record("library.root.v3", {
        kind: "library-root",
        protocolVersion: 1,
        deleted: false,
        libraryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        libraryGeneration: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    ],
    [
      "atomic.library.v2",
      record("atomic.library.v2", {
        kind: "atomic-library",
        protocolVersion: 2,
        deleted: false,
        pageCount: 1,
      }),
    ],
    [
      "catalog.0",
      record("catalog.0", {
        kind: "catalog-page",
        protocolVersion: 2,
        index: 0,
        deckIds: [deckA, deckA, deckB],
      }),
    ],
    [
      `ledger.${deckA}`,
      record(`ledger.${deckA}`, {
        kind: "deck-ledger",
        protocolVersion: 2,
        pageCount: 1,
        control: { deckId: deckA, deleted: false },
      }),
    ],
    [
      `ledger.${deckB}`,
      record(`ledger.${deckB}`, {
        kind: "deck-ledger",
        protocolVersion: 2,
        pageCount: 1,
        control: { deckId: deckB, deleted: false },
      }),
    ],
    [
      `ledger.${deckA}.0`,
      record(`ledger.${deckA}.0`, {
        kind: "ledger-page",
        protocolVersion: 2,
        deckId: deckA,
        index: 0,
        entries: [
          {
            logicalName: "review.ignore",
            physicalName: `payload.${"c".repeat(64)}`,
            category: "progress",
          },
          {
            logicalName: "asset.ignore",
            physicalName: `payload.${"d".repeat(64)}`,
            category: "content",
          },
          {
            logicalName: "revision.one",
            physicalName: payloadA,
            category: "content",
          },
        ],
      }),
    ],
    [
      `ledger.${deckB}.0`,
      record(`ledger.${deckB}.0`, {
        kind: "ledger-page",
        protocolVersion: 2,
        deckId: deckB,
        index: 0,
        entries: [
          {
            logicalName: "revision.two",
            physicalName: payloadB,
            category: "content",
          },
        ],
      }),
    ],
    [
      payloadA,
      record(payloadA, {
        deckId: deckA,
        header: {
          title: "Parent",
          parentDeckId: null,
          cardCount: 3,
        },
      }),
    ],
    [
      payloadB,
      record(payloadB, {
        deckId: deckB,
        header: {
          title: "Child",
          parentDeckId: deckA,
          cardCount: 2,
        },
      }),
    ],
  ]);
  const calls: string[][] = [];
  const reader = vi.fn(async (names: readonly string[]) => {
    calls.push([...names]);
    return names.flatMap((name) => records.get(name) ?? []);
  });
  return { calls, reader };
}

describe("bounded read-only CloudKit inventory", () => {
  it("deduplicates IDs and skips content and progress payloads", async () => {
    const { calls, reader } = fixture();
    const result = await readBoundedCloudInventory(reader);

    expect(result.decks).toEqual([
      {
        id: deckA,
        title: "Parent",
        parentDeckId: null,
        cardCount: 3,
      },
      {
        id: deckB,
        title: "Child",
        parentDeckId: deckA,
        cardCount: 2,
      },
    ]);
    expect(result.incomplete).toBe(true);
    expect(result.requestCount).toBeLessThanOrEqual(
      cloudInventoryMaximumRequests,
    );
    expect(calls.flat()).not.toContain(
      `payload.${"c".repeat(64)}`,
    );
    expect(calls.flat()).not.toContain(
      `payload.${"d".repeat(64)}`,
    );
  });

  it("fails closed before an unbounded catalog walk", async () => {
    const reader = vi.fn(async (names: readonly string[]) =>
      names.map((name) =>
        record(
          name,
          name === "library.root.v3"
            ? {
                kind: "library-root",
                protocolVersion: 1,
                deleted: false,
                libraryId: "a",
                libraryGeneration: "b",
              }
            : {
                kind: "atomic-library",
                protocolVersion: 2,
                deleted: false,
                pageCount: 9,
              },
        ),
      ),
    );

    await expect(
      readBoundedCloudInventory(reader),
    ).rejects.toMatchObject({
      name: "CloudInventoryError",
      requestCount: 2,
    });
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("merges local and cloud decks by stable ID", () => {
    const merged = mergeCloudInventoryDecks(
      [
        {
          id: deckA,
          title: "Local parent",
          parentDeckId: null,
          cardCount: 4,
        },
      ],
      [
        {
          id: deckA,
          title: "Cloud parent",
          parentDeckId: null,
          cardCount: 3,
        },
        {
          id: deckB,
          title: "Child",
          parentDeckId: deckA,
          cardCount: 2,
        },
      ],
    );
    expect(
      merged.map(({ id, availability }) => [id, availability]),
    ).toEqual([
      [deckA, "both"],
      [deckB, "cloud"],
    ]);
    expect(merged[0]?.title).toBe("Local parent");
  });
});
