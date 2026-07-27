import type { DeckSummary } from "@flashcards/api-client";

export type HierarchicalDeck = {
  deck: DeckSummary;
  depth: number;
};

const compareDeckTitles = (left: DeckSummary, right: DeckSummary) =>
  left.title.localeCompare(right.title);

export function buildDeckHierarchy(
  decks: readonly DeckSummary[],
): HierarchicalDeck[] {
  const knownIds = new Set(decks.map((deck) => deck.id));
  const childrenByParent = new Map<string | null, DeckSummary[]>();

  for (const deck of decks) {
    const parentId =
      deck.parentDeckId &&
      deck.parentDeckId !== deck.id &&
      knownIds.has(deck.parentDeckId)
        ? deck.parentDeckId
        : null;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(deck);
    childrenByParent.set(parentId, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort(compareDeckTitles);
  }

  const result: HierarchicalDeck[] = [];
  const visited = new Set<string>();
  const appendBranch = (deck: DeckSummary, depth: number) => {
    if (visited.has(deck.id)) return;
    visited.add(deck.id);
    result.push({ deck, depth });
    for (const child of childrenByParent.get(deck.id) ?? []) {
      appendBranch(child, depth + 1);
    }
  };

  for (const root of childrenByParent.get(null) ?? []) {
    appendBranch(root, 0);
  }
  for (const remaining of [...decks].sort(compareDeckTitles)) {
    appendBranch(remaining, 0);
  }

  return result;
}

export function buildParentDeckHierarchy(
  decks: readonly DeckSummary[],
  currentDeckId?: string,
): HierarchicalDeck[] {
  if (!currentDeckId) return buildDeckHierarchy(decks);

  const childrenByParent = new Map<string, string[]>();
  for (const deck of decks) {
    if (!deck.parentDeckId) continue;
    const children = childrenByParent.get(deck.parentDeckId) ?? [];
    children.push(deck.id);
    childrenByParent.set(deck.parentDeckId, children);
  }

  const excludedIds = new Set<string>();
  const pendingIds = [currentDeckId];
  while (pendingIds.length > 0) {
    const id = pendingIds.pop();
    if (!id || excludedIds.has(id)) continue;
    excludedIds.add(id);
    pendingIds.push(...(childrenByParent.get(id) ?? []));
  }

  return buildDeckHierarchy(decks.filter((deck) => !excludedIds.has(deck.id)));
}

export function deckHierarchyPrefix(depth: number): string {
  return depth > 0 ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : "";
}
