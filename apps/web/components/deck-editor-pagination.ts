import type { DeckCardPage, DeckDetail } from "@flashcards/api-client";

export const DECK_EDITOR_CARD_PAGE_SIZE = 1_000;

export const paginatedCachedDeck = (
  deck: DeckDetail,
  requestedPage: number,
  pageSize = DECK_EDITOR_CARD_PAGE_SIZE,
  search?: string,
): DeckCardPage => {
  const normalizedSearch = search?.trim().toLocaleLowerCase();
  const matchingCards = normalizedSearch
    ? deck.cards.filter((card) =>
        JSON.stringify([card.front, card.back, card.translations])
          .toLocaleLowerCase()
          .includes(normalizedSearch),
      )
    : deck.cards;
  const totalCards = matchingCards.length;
  const totalPages = Math.max(1, Math.ceil(totalCards / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return {
    ...deck,
    cards: matchingCards.slice((page - 1) * pageSize, page * pageSize),
    cardPage: { page, pageSize, totalCards, totalPages },
  };
};
