import { describe, expect, it } from "vitest";

import { filterStudyVisibleDecks } from "./study-deck-visibility.js";

describe("all-decks study visibility", () => {
  const decks = [
    { id: "visible", parentDeckId: null, hiddenAt: null },
    {
      id: "hidden",
      parentDeckId: null,
      hiddenAt: new Date("2026-07-28T08:00:00.000Z"),
    },
    { id: "hidden-child", parentDeckId: "hidden", hiddenAt: null },
    { id: "visible-child", parentDeckId: "visible", hiddenAt: null },
    {
      id: "directly-hidden-child",
      parentDeckId: "visible",
      hiddenAt: new Date("2026-07-28T08:00:00.000Z"),
    },
  ];

  it("excludes directly hidden decks", () => {
    expect(filterStudyVisibleDecks(decks).map((deck) => deck.id)).not.toContain(
      "directly-hidden-child",
    );
  });

  it("excludes every descendant of a hidden collection", () => {
    expect(filterStudyVisibleDecks(decks).map((deck) => deck.id)).toEqual([
      "visible",
      "visible-child",
    ]);
  });
});
