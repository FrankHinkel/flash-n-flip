import { describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";

import { orderLocalStudyCards } from "./study-local-order";

const dueCard = (id: string, deckId: string, position: number) =>
  ({ card: { id, deckId, position } }) as DueCard;

describe("orderLocalStudyCards", () => {
  const cards = [
    dueCard("a-2", "deck-a", 2),
    dueCard("b-2", "deck-b", 2),
    dueCard("a-1", "deck-a", 1),
    dueCard("b-1", "deck-b", 1),
  ];

  it("applies sequential collection order to offline cards", () => {
    expect(
      orderLocalStudyCards(
        cards,
        ["collection", "deck-b", "deck-a"],
        "SEQUENTIAL",
      ).map(({ card }) => card.id),
    ).toEqual(["b-1", "b-2", "a-1", "a-2"]);
  });

  it("does not reorder scheduled offline cards", () => {
    expect(
      orderLocalStudyCards(
        cards,
        ["collection", "deck-b", "deck-a"],
        "SCHEDULED",
      ),
    ).toEqual(cards);
  });
});
