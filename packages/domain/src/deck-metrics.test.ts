import { describe, expect, it } from "vitest";

import {
  aggregateDeckMetrics,
  aggregateProgressUnitMetrics,
  archivedDeckIds,
  archiveMarkerDeckId,
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  restorableDeckIds,
  visibleDeckIds,
} from "./deck-metrics";

describe("deck metrics", () => {
  it("collects a deck and all nested descendants for deletion", () => {
    const descendants = deckDescendantIds(
      [
        { id: "world", parentDeckId: null },
        { id: "europe", parentDeckId: "world" },
        { id: "germany", parentDeckId: "europe" },
        { id: "standalone", parentDeckId: null },
      ],
      "world",
    );

    expect([...descendants]).toEqual(["world", "europe", "germany"]);
    expect(deckDescendantIds([], "missing").size).toBe(0);
  });

  it("hides a deck and every descendant outside library management", () => {
    const visible = visibleDeckIds([
      { id: "world", parentDeckId: null, hiddenAt: new Date() },
      { id: "europe", parentDeckId: "world", hiddenAt: null },
      { id: "germany", parentDeckId: "europe", hiddenAt: null },
      { id: "standalone", parentDeckId: null, hiddenAt: null },
    ]);

    expect([...visible]).toEqual(["standalone"]);
  });

  it("inherits one archive marker through the complete subtree", () => {
    const archivedAt = new Date("2026-08-11T18:00:00.000Z");
    const decks = [
      { id: "collection", parentDeckId: null, archivedAt },
      { id: "unit", parentDeckId: "collection", archivedAt: null },
      { id: "lesson", parentDeckId: "unit", archivedAt: null },
      { id: "active", parentDeckId: null, archivedAt: null },
    ];

    expect(archivedDeckIds(decks)).toEqual(
      new Set(["collection", "unit", "lesson"]),
    );
    expect(archiveMarkerDeckId(decks, "lesson")).toBe("collection");
    expect(archiveMarkerDeckId(decks, "active")).toBeNull();
  });

  it("keeps a separately archived child archived after its parent is restored", () => {
    const archivedAt = new Date("2026-08-11T18:00:00.000Z");
    const restored = [
      { id: "collection", parentDeckId: null, archivedAt: null },
      { id: "unit", parentDeckId: "collection", archivedAt },
      { id: "lesson", parentDeckId: "unit", archivedAt: null },
    ];

    expect(archivedDeckIds(restored)).toEqual(new Set(["unit", "lesson"]));
    expect(archiveMarkerDeckId(restored, "lesson")).toBe("unit");
  });

  it("restores the selected subtree and its archived ancestor path", () => {
    const archivedAt = new Date("2026-07-28T20:00:00.000Z");
    expect(
      restorableDeckIds(
        [
          { id: "collection", parentDeckId: null, archivedAt },
          { id: "unit", parentDeckId: "collection", archivedAt },
          { id: "lesson", parentDeckId: "unit", archivedAt },
          { id: "sibling", parentDeckId: "collection", archivedAt },
        ],
        "unit",
      ),
    ).toEqual(new Set(["unit", "lesson", "collection"]));
  });

  it("does not restore an active or unknown deck", () => {
    const decks = [
      { id: "active", parentDeckId: null, archivedAt: null },
    ] as const;
    expect(restorableDeckIds(decks, "active")).toEqual(new Set());
    expect(restorableDeckIds(decks, "missing")).toEqual(new Set());
  });

  it("derives progress from reviewed cards without exceeding bounds", () => {
    expect(deckProgressPercent(3, 4)).toBe(75);
    expect(deckProgressPercent(2, 0)).toBe(0);
    expect(deckProgressPercent(9, 4)).toBe(100);
  });

  it("aggregates direct and nested deck metrics into every hierarchy node", () => {
    const metrics = aggregateDeckMetrics([
      {
        id: "collection",
        parentDeckId: null,
        cardCount: 2,
        reviewedCardCount: 1,
        storageBytes: 20,
      },
      {
        id: "unit",
        parentDeckId: "collection",
        cardCount: 3,
        reviewedCardCount: 2,
        storageBytes: 30,
      },
      {
        id: "lesson",
        parentDeckId: "unit",
        cardCount: 5,
        reviewedCardCount: 4,
        storageBytes: 50,
      },
    ]);

    expect(metrics.get("collection")).toEqual({
      cardCount: 10,
      reviewedCardCount: 7,
      storageBytes: 100,
    });
    expect(metrics.get("unit")).toEqual({
      cardCount: 8,
      reviewedCardCount: 6,
      storageBytes: 80,
    });
    expect(metrics.get("lesson")).toEqual({
      cardCount: 5,
      reviewedCardCount: 4,
      storageBytes: 50,
    });
  });

  it("aggregates learned virtual progress units instead of generated exercises", () => {
    const metrics = aggregateProgressUnitMetrics([
      {
        id: "root",
        parentDeckId: null,
        tags: [],
        cardCount: 0,
        reviewedCardCount: 0,
        storageBytes: 0,
      },
      {
        id: "pair",
        parentDeckId: "root",
        tags: [],
        cardCount: 0,
        reviewedCardCount: 0,
        storageBytes: 0,
      },
      {
        id: "learned",
        parentDeckId: "pair",
        tags: ["virtual-progress-unit"],
        cardCount: 3,
        reviewedCardCount: 3,
        storageBytes: 0,
      },
      {
        id: "open",
        parentDeckId: "pair",
        tags: ["virtual-progress-unit"],
        cardCount: 5,
        reviewedCardCount: 2,
        storageBytes: 0,
      },
    ]);
    expect(metrics.get("root")).toEqual({ total: 2, reviewed: 1 });
    expect(metrics.get("pair")).toEqual({ total: 2, reviewed: 1 });
    expect(metrics.get("learned")).toEqual({ total: 1, reviewed: 1 });
  });

  it("excludes hidden hierarchy branches from visible collection totals", () => {
    const decks = [
      {
        id: "collection",
        parentDeckId: null,
        hiddenAt: null,
        cardCount: 1,
        reviewedCardCount: 1,
        storageBytes: 10,
      },
      {
        id: "hidden-unit",
        parentDeckId: "collection",
        hiddenAt: new Date(),
        cardCount: 4,
        reviewedCardCount: 3,
        storageBytes: 40,
      },
      {
        id: "hidden-lesson",
        parentDeckId: "hidden-unit",
        hiddenAt: null,
        cardCount: 5,
        reviewedCardCount: 4,
        storageBytes: 50,
      },
      {
        id: "visible-lesson",
        parentDeckId: "collection",
        hiddenAt: null,
        cardCount: 2,
        reviewedCardCount: 1,
        storageBytes: 20,
      },
    ];

    const metrics = aggregateDeckMetrics(decks, visibleDeckIds(decks));

    expect(metrics.get("collection")).toEqual({
      cardCount: 3,
      reviewedCardCount: 2,
      storageBytes: 30,
    });
    expect(metrics.has("hidden-unit")).toBe(false);
    expect(metrics.has("hidden-lesson")).toBe(false);
  });

  it("formats compact localized byte sizes", () => {
    expect(formatByteSize(0, "en")).toBe("0 B");
    expect(formatByteSize(1536, "en")).toBe("1.5 KB");
    expect(formatByteSize(1536, "de")).toBe("1,5 KB");
  });
});
