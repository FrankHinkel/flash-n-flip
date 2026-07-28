import { describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";

import { selectCachedDueCards } from "./offline";

const due = (cardId: string, deckId: string): DueCard =>
  ({
    card: { id: cardId, deckId },
  }) as DueCard;

describe("offline collection study scope", () => {
  const cards = [
    due("root-card", "collection"),
    due("child-card", "child"),
    due("other-card", "other"),
  ];

  it("restores cards from the selected collection and its subdecks", () => {
    expect(
      selectCachedDueCards(cards, "collection", ["root-card", "child-card"])
        .map((item) => item.card.id),
    ).toEqual(["root-card", "child-card"]);
  });

  it("falls back to exact deck matching for legacy caches", () => {
    expect(
      selectCachedDueCards(cards, "collection").map((item) => item.card.id),
    ).toEqual(["root-card"]);
  });
});
