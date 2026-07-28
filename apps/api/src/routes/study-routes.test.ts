import { describe, expect, it } from "vitest";

import {
  securelyRecognizedCardIds,
  studyDeckScope,
} from "./study-routes.js";

const event = (
  cardId: string,
  rating: "AGAIN" | "HARD" | "GOOD" | "EASY",
  reviewedAt: string,
  createdAt = reviewedAt,
) => ({
  cardId,
  rating,
  reviewedAt: new Date(reviewedAt),
  createdAt: new Date(createdAt),
});

describe("study confidence", () => {
  it("marks cards whose latest review was GOOD or EASY", () => {
    expect(
      securelyRecognizedCardIds([
        event("good", "GOOD", "2026-07-25T10:00:00.000Z"),
        event("easy", "EASY", "2026-07-25T10:00:00.000Z"),
        event("hard", "HARD", "2026-07-25T10:00:00.000Z"),
        event("again", "AGAIN", "2026-07-25T10:00:00.000Z"),
      ]),
    ).toEqual(["good", "easy"]);
  });

  it("uses the latest immutable review instead of lifetime success", () => {
    expect(
      securelyRecognizedCardIds([
        event("forgotten", "GOOD", "2026-07-24T10:00:00.000Z"),
        event("forgotten", "AGAIN", "2026-07-25T10:00:00.000Z"),
        event("recovered", "AGAIN", "2026-07-24T10:00:00.000Z"),
        event("recovered", "EASY", "2026-07-25T10:00:00.000Z"),
      ]),
    ).toEqual(["recovered"]);
  });

  it("breaks equal review timestamps by the persisted event time", () => {
    expect(
      securelyRecognizedCardIds([
        event(
          "same-time",
          "GOOD",
          "2026-07-25T10:00:00.000Z",
          "2026-07-25T10:00:01.000Z",
        ),
        event(
          "same-time",
          "AGAIN",
          "2026-07-25T10:00:00.000Z",
          "2026-07-25T10:00:02.000Z",
        ),
      ]),
    ).toEqual([]);
  });
});

describe("study deck scope", () => {
  const decks = [
    { id: "collection", parentDeckId: null },
    { id: "child-a", parentDeckId: "collection" },
    { id: "child-b", parentDeckId: "collection" },
    { id: "grandchild", parentDeckId: "child-a" },
    { id: "unrelated", parentDeckId: null },
  ];

  it("selects the collection, all descendants, and no unrelated deck", () => {
    expect(studyDeckScope(decks, "collection", true)).toEqual([
      "collection",
      "child-a",
      "child-b",
      "grandchild",
    ]);
  });

  it("keeps exact-deck scope when descendants are not requested", () => {
    expect(studyDeckScope(decks, "child-a", false)).toEqual(["child-a"]);
  });

  it("rejects a deck outside the visible owned scope", () => {
    expect(() => studyDeckScope(decks, "hidden", true)).toThrow(
      "Deck not found",
    );
  });
});
