import { describe, expect, it } from "vitest";

import {
  aggregateDeckMetrics,
  aggregateProgressUnitMetrics,
} from "@flashcards/domain";

import { deckDisplayedProgress } from "./deck-list";

describe("deck list virtual progress units", () => {
  it("shows learned categories instead of generated exercise cards", () => {
    expect(
      deckDisplayedProgress({
        cardCount: 39,
        reviewedCardCount: 17,
        progressUnits: { kind: "CATEGORY", total: 13, reviewed: 4 },
      }),
    ).toEqual({ total: 13, reviewed: 4, unit: "CATEGORY" });
  });

  it("keeps ordinary deck progress card based", () => {
    expect(
      deckDisplayedProgress({ cardCount: 20, reviewedCardCount: 5 }),
    ).toEqual({ total: 20, reviewed: 5, unit: "CARD" });
  });

  it("aggregates curated child cards for an empty collection root", () => {
    const decks = [
      {
        id: "root",
        parentDeckId: null,
        cardCount: 0,
        reviewedCardCount: 0,
        storageBytes: 10,
        tags: [],
      },
      {
        id: "child",
        parentDeckId: "root",
        cardCount: 24,
        reviewedCardCount: 3,
        storageBytes: 90,
        tags: [],
      },
    ];

    expect(aggregateDeckMetrics(decks).get("root")).toEqual({
      cardCount: 24,
      reviewedCardCount: 3,
      storageBytes: 100,
    });
    expect(aggregateProgressUnitMetrics(decks).get("root")).toBeUndefined();
  });
});
