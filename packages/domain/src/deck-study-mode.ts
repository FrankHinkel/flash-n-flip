export const developerReferenceTag = "Developer reference";
export const optionalPracticeTag = "Optional practice";

export function hasDeveloperReferenceTag(
  ...deckTagGroups: (readonly string[] | null | undefined)[]
): boolean {
  return deckTagGroups.some((tags) => tags?.includes(developerReferenceTag));
}

export type DeckStudyModeNode = {
  id: string;
  parentDeckId?: string | null;
  tags?: readonly string[] | null;
};

export function developerReferenceDeckIds(
  decks: readonly DeckStudyModeNode[],
): Set<string> {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const result = new Set<string>();
  const resolved = new Map<string, boolean>();

  const isReference = (deckId: string, visiting: Set<string>): boolean => {
    const cached = resolved.get(deckId);
    if (cached !== undefined) return cached;
    const deck = byId.get(deckId);
    if (!deck || visiting.has(deckId)) return false;
    const nextVisiting = new Set(visiting).add(deckId);
    const reference =
      hasDeveloperReferenceTag(deck.tags) ||
      Boolean(
        deck.parentDeckId && isReference(deck.parentDeckId, nextVisiting),
      );
    resolved.set(deckId, reference);
    if (reference) result.add(deckId);
    return reference;
  };

  for (const deck of decks) isReference(deck.id, new Set());
  return result;
}

export function hasOptionalPracticeTag(
  ...deckTagGroups: (readonly string[] | null | undefined)[]
): boolean {
  return deckTagGroups.some((tags) => tags?.includes(optionalPracticeTag));
}
