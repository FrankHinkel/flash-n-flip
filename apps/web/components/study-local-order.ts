import type { DueCard } from "@flashcards/api-client";
import {
  orderSequentialStudyScope,
  type DeckStudyOrder,
} from "@flashcards/domain";

export const orderLocalStudyCards = (
  cards: readonly DueCard[],
  orderedDeckIds: readonly string[],
  studyOrder: DeckStudyOrder,
): DueCard[] =>
  studyOrder === "SEQUENTIAL"
    ? orderSequentialStudyScope(cards, orderedDeckIds, (item) => ({
        deckId: item.card.deckId,
        position: item.card.position ?? Number.MAX_SAFE_INTEGER,
      }))
    : [...cards];
