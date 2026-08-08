import { describe, expect, it } from "vitest";

import type { Card, DeckDetail } from "@flashcards/api-client";

import {
  DECK_EDITOR_CARD_PAGE_SIZE,
  paginatedCachedDeck,
} from "./deck-editor-pagination";

const card = (index: number): Card => ({
  id: `card-${index}`,
  deckId: "deck-1",
  noteId: `note-${index}`,
  front: { blocks: [{ type: "text", text: `Question ${index}` }] },
  back: { blocks: [{ type: "text", text: `Answer ${index}` }] },
  translations: {},
  version: 1,
  suspended: false,
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
});

const deck = (cardCount: number): DeckDetail =>
  ({
    id: "deck-1",
    cards: Array.from({ length: cardCount }, (_, index) => card(index + 1)),
  }) as DeckDetail;

describe("deck editor card pagination", () => {
  it("keeps a deck of at most 1,000 cards on a single page", () => {
    const page = paginatedCachedDeck(deck(DECK_EDITOR_CARD_PAGE_SIZE), 1);

    expect(page.cards).toHaveLength(1_000);
    expect(page.cardPage).toEqual({
      page: 1,
      pageSize: 1_000,
      totalCards: 1_000,
      totalPages: 1,
    });
  });

  it("returns only the requested block and clamps pages", () => {
    const middle = paginatedCachedDeck(deck(2_005), 2);
    const clamped = paginatedCachedDeck(deck(2_005), 99);

    expect(middle.cards).toHaveLength(1_000);
    expect(middle.cards[0]?.id).toBe("card-1001");
    expect(middle.cardPage).toMatchObject({ page: 2, totalPages: 3 });
    expect(clamped.cards.map(({ id }) => id)).toEqual([
      "card-2001",
      "card-2002",
      "card-2003",
      "card-2004",
      "card-2005",
    ]);
    expect(clamped.cardPage.page).toBe(3);
  });

  it("searches the complete cached deck before applying a page", () => {
    const cached = deck(1_500);
    cached.cards[1_250]!.back = {
      blocks: [{ type: "text", text: "Crane species" }],
    };

    const result = paginatedCachedDeck(cached, 1, 1_000, "crane SPECIES");

    expect(result.cards.map(({ id }) => id)).toEqual(["card-1251"]);
    expect(result.cardPage).toMatchObject({ totalCards: 1, totalPages: 1 });
  });
});
