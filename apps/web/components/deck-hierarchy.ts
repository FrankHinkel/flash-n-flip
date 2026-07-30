import type { DeckSummary } from "@flashcards/api-client";

export type HierarchicalDeck = {
  deck: DeckSummary;
  depth: number;
};

export type AccordionDeck = HierarchicalDeck & {
  path: string[];
  hasChildren: boolean;
  expanded: boolean;
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

export function directChildDecks(
  decks: readonly DeckSummary[],
  parentDeckId: string,
): DeckSummary[] {
  return decks
    .filter(
      (deck) =>
        deck.parentDeckId === parentDeckId &&
        !deck.archivedAt &&
        !deck.hiddenAt,
    )
    .sort(compareDeckTitles);
}

export function buildDeckAccordion(
  decks: readonly DeckSummary[],
  expandedPath: readonly string[],
): AccordionDeck[] {
  const hierarchy = buildDeckHierarchy(decks);
  const paths: string[][] = [];
  const branch: string[] = [];
  hierarchy.forEach(({ deck, depth }) => {
    branch[depth] = deck.id;
    branch.length = depth + 1;
    paths.push([...branch]);
  });

  return hierarchy.flatMap(({ deck, depth }, index) => {
    const path = paths[index] ?? [deck.id];
    const parentPath = path.slice(0, -1);
    const visible = parentPath.every(
      (parentId, parentDepth) => expandedPath[parentDepth] === parentId,
    );
    if (!visible) return [];
    return [
      {
        deck,
        depth,
        path,
        hasChildren: (hierarchy[index + 1]?.depth ?? 0) > depth,
        expanded: expandedPath[depth] === deck.id,
      },
    ];
  });
}

export function deckAccordionPathForDeck(
  decks: readonly DeckSummary[],
  deckId: string,
): string[] {
  if (!deckId) return [];
  const branch: string[] = [];
  for (const { deck, depth } of buildDeckHierarchy(decks)) {
    branch[depth] = deck.id;
    branch.length = depth + 1;
    if (deck.id === deckId) return [...branch];
  }
  return [];
}

export function toggleDeckAccordionPath(
  currentPath: readonly string[],
  row: Pick<AccordionDeck, "deck" | "depth" | "path">,
): string[] {
  return currentPath[row.depth] === row.deck.id
    ? row.path.slice(0, -1)
    : [...row.path];
}

export function deckHierarchyPrefix(depth: number): string {
  return depth > 0 ? `${"\u00a0\u00a0".repeat(depth)}↳ ` : "";
}
