export const pendingLocalImportDeckStorageKey =
  "flash-n-flip:pending-local-import-deck.v1";

export function localImportFocusDeckId(result: {
  deckId: string;
  dictionaryDeckIds?: readonly string[];
}): string {
  return result.dictionaryDeckIds?.[0] ?? result.deckId;
}

export function importedDeckExpansionIds(
  decks: readonly { id: string; parentDeckId?: string | null }[],
  importedDeckId: string,
): ReadonlySet<string> | null {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  let current = byId.get(importedDeckId);
  if (!current) return null;
  const expanded = new Set<string>();
  const visited = new Set([current.id]);
  while (current.parentDeckId) {
    if (visited.has(current.parentDeckId)) return null;
    const parent = byId.get(current.parentDeckId);
    if (!parent) break;
    expanded.add(parent.id);
    visited.add(parent.id);
    current = parent;
  }
  return expanded;
}
