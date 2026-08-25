import { describe, expect, it } from "vitest";

import {
  aggregateDeckMetrics,
  aggregateProgressUnitMetrics,
} from "@flashcards/domain";

import {
  activeStudyPlanCardProgress,
  activeStudyPlanCardProgressByDeck,
  deckDisplayedProgress,
} from "./deck-list";

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

  it("counts each visible plan deck once and excludes inactive branches", () => {
    expect(
      activeStudyPlanCardProgress([
        {
          id: "root",
          parentDeckId: null,
          learningEnabled: true,
          hiddenAt: null,
          archivedAt: null,
          cardCount: 2,
          reviewedCardCount: 1,
        },
        {
          id: "child",
          parentDeckId: "root",
          learningEnabled: true,
          hiddenAt: null,
          archivedAt: null,
          cardCount: 3,
          reviewedCardCount: 2,
          metricsPending: true,
        },
        {
          id: "hidden",
          parentDeckId: "root",
          learningEnabled: true,
          hiddenAt: "2026-08-19T12:00:00.000Z",
          archivedAt: null,
          cardCount: 50,
          reviewedCardCount: 40,
        },
        {
          id: "not-in-plan",
          parentDeckId: null,
          learningEnabled: false,
          hiddenAt: null,
          archivedAt: null,
          cardCount: 20,
          reviewedCardCount: 10,
        },
      ]),
    ).toEqual({ total: 5, reviewed: 3, pending: true });
  });

  it("separates full subtree inventory from the selected study-plan subset", () => {
    const progress = activeStudyPlanCardProgressByDeck([
      {
        id: "root",
        parentDeckId: null,
        learningEnabled: false,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 5,
        reviewedCardCount: 2,
      },
      {
        id: "selected-child",
        parentDeckId: "root",
        learningEnabled: true,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 12,
        reviewedCardCount: 0,
      },
      {
        id: "unselected-child",
        parentDeckId: "root",
        learningEnabled: false,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 13,
        reviewedCardCount: 7,
      },
    ]);

    expect(progress.get("root")).toEqual({
      total: 12,
      reviewed: 0,
      pending: false,
    });
    expect(progress.get("selected-child")).toEqual({
      total: 12,
      reviewed: 0,
      pending: false,
    });
    expect(progress.get("unselected-child")).toEqual({
      total: 0,
      reviewed: 0,
      pending: false,
    });
  });

  it("excludes hidden and archived selections and propagates pending selected metrics", () => {
    const progress = activeStudyPlanCardProgressByDeck([
      {
        id: "root",
        parentDeckId: null,
        learningEnabled: false,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 0,
        reviewedCardCount: 0,
      },
      {
        id: "pending",
        parentDeckId: "root",
        learningEnabled: true,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 4,
        reviewedCardCount: 1,
        metricsPending: true,
      },
      {
        id: "hidden",
        parentDeckId: "root",
        learningEnabled: true,
        hiddenAt: "2026-08-22T10:00:00.000Z",
        archivedAt: null,
        cardCount: 20,
        reviewedCardCount: 10,
      },
      {
        id: "archived",
        parentDeckId: "root",
        learningEnabled: true,
        hiddenAt: null,
        archivedAt: "2026-08-22T10:00:00.000Z",
        cardCount: 30,
        reviewedCardCount: 15,
      },
    ]);

    expect(progress.get("root")).toEqual({
      total: 4,
      reviewed: 1,
      pending: true,
    });
  });

  it("excludes reference hierarchies from learning-plan progress", () => {
    const progress = activeStudyPlanCardProgressByDeck([
      {
        id: "reference-root",
        parentDeckId: null,
        learningEnabled: true,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 0,
        reviewedCardCount: 0,
        tags: ["Developer reference"],
      },
      {
        id: "reference-child",
        parentDeckId: "reference-root",
        learningEnabled: true,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 30,
        reviewedCardCount: 12,
        tags: [],
      },
      {
        id: "learning",
        parentDeckId: null,
        learningEnabled: true,
        hiddenAt: null,
        archivedAt: null,
        cardCount: 4,
        reviewedCardCount: 1,
        tags: [],
      },
    ]);

    expect(progress.get("reference-root")).toEqual({
      total: 0,
      reviewed: 0,
      pending: false,
    });
    expect(progress.get("reference-child")).toEqual({
      total: 0,
      reviewed: 0,
      pending: false,
    });
    expect(progress.get("learning")).toEqual({
      total: 4,
      reviewed: 1,
      pending: false,
    });
  });
});
