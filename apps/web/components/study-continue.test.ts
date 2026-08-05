import { describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

import {
  applySessionRatings,
  cardsForContinuedStudy,
  continueRatingCounts,
  defaultContinueRatings,
  toggleContinueRating,
} from "./study-continue";

const card = (
  id: string,
  lastRating: ReviewRating | null,
  studyMode: DueCard["studyMode"] = "LEARNING",
) =>
  ({
    card: { id },
    lastRating,
    studyMode,
  }) as DueCard;

describe("continued study selection", () => {
  const cards = [
    card("again", "AGAIN"),
    card("hard", "HARD"),
    card("good", "GOOD"),
    card("easy", "EASY"),
    card("unrated", null),
    card("reference", "AGAIN", "REFERENCE"),
  ];

  it("defaults to Again, Hard and Good while excluding Easy", () => {
    expect(defaultContinueRatings).toEqual(["AGAIN", "HARD", "GOOD"]);
    expect(
      cardsForContinuedStudy(cards, defaultContinueRatings).map(
        (item) => item.card.id,
      ),
    ).toEqual(["again", "hard", "good"]);
  });

  it("counts only rated learning cards", () => {
    expect(continueRatingCounts(cards)).toEqual({
      AGAIN: 1,
      HARD: 1,
      GOOD: 1,
      EASY: 1,
    });
  });

  it("allows every checkbox to be toggled independently", () => {
    expect(toggleContinueRating(defaultContinueRatings, "GOOD")).toEqual([
      "AGAIN",
      "HARD",
    ]);
    expect(toggleContinueRating(defaultContinueRatings, "EASY")).toEqual([
      "AGAIN",
      "HARD",
      "GOOD",
      "EASY",
    ]);
  });

  it("projects ratings saved during the current run onto a stale server response", () => {
    const staleCards = [card("first", null), card("second", "HARD")];
    expect(
      applySessionRatings(staleCards, { first: "GOOD", second: "EASY" }).map(
        (item) => item.lastRating,
      ),
    ).toEqual(["GOOD", "EASY"]);
  });
});
