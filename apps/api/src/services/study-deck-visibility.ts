import { visibleDeckIds } from "@flashcards/domain";

export const filterStudyVisibleDecks = <
  T extends {
    id: string;
    parentDeckId: string | null;
    hiddenAt: string | Date | null;
  },
>(
  ownedDecks: readonly T[],
): T[] => {
  const visibleIds = visibleDeckIds(ownedDecks);
  return ownedDecks.filter((deck) => visibleIds.has(deck.id));
};
