export type DeckTreeNode = {
  id: string;
  parentDeckId: string | null;
};

export const toggleExpandedDeckPath = (
  current: ReadonlySet<string>,
  deckId: string,
  decks: DeckTreeNode[],
): Set<string> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  if (current.has(deckId)) {
    const next = new Set(current);
    for (const candidate of decks) {
      let ancestorId: string | null = candidate.id;
      while (ancestorId) {
        if (ancestorId === deckId) {
          next.delete(candidate.id);
          break;
        }
        ancestorId = byId.get(ancestorId)?.parentDeckId ?? null;
      }
    }
    return next;
  }

  const path: string[] = [];
  let currentId: string | null = deckId;
  while (currentId) {
    path.unshift(currentId);
    currentId = byId.get(currentId)?.parentDeckId ?? null;
  }
  return new Set(path);
};
