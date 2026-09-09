export type MyICloudDeckTreeItem = {
  id: string;
  parentDeckId: string | null;
};

export type MyICloudDeckTreeNode<T extends MyICloudDeckTreeItem> = {
  deck: T;
  children: MyICloudDeckTreeNode<T>[];
};

export type MyICloudDeckTree<T extends MyICloudDeckTreeItem> = {
  roots: MyICloudDeckTreeNode<T>[];
  withheldCount: number;
};

export type MyICloudDeckTreeRow<T extends MyICloudDeckTreeItem> = {
  deck: T;
  depth: number;
  hasChildren: boolean;
};

export function buildMyICloudDeckTree<T extends MyICloudDeckTreeItem>(
  decks: readonly T[],
): MyICloudDeckTree<T> {
  const orderedDecks: T[] = [];
  const byId = new Map<string, T>();

  for (const deck of decks) {
    if (byId.has(deck.id)) continue;
    byId.set(deck.id, deck);
    orderedDecks.push(deck);
  }

  const validity = new Map<string, boolean>();
  const isValid = (id: string, visiting: Set<string>): boolean => {
    const cached = validity.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) {
      validity.set(id, false);
      return false;
    }

    const deck = byId.get(id);
    if (!deck) return false;
    if (deck.parentDeckId === null) {
      validity.set(id, true);
      return true;
    }
    if (!byId.has(deck.parentDeckId)) {
      validity.set(id, false);
      return false;
    }

    visiting.add(id);
    const valid = isValid(deck.parentDeckId, visiting);
    visiting.delete(id);
    validity.set(id, valid);
    return valid;
  };

  for (const deck of orderedDecks) isValid(deck.id, new Set());

  const nodes = new Map<string, MyICloudDeckTreeNode<T>>();
  for (const deck of orderedDecks) {
    if (validity.get(deck.id)) nodes.set(deck.id, { deck, children: [] });
  }

  const roots: MyICloudDeckTreeNode<T>[] = [];
  for (const deck of orderedDecks) {
    const node = nodes.get(deck.id);
    if (!node) continue;
    if (deck.parentDeckId === null) {
      roots.push(node);
    } else {
      nodes.get(deck.parentDeckId)?.children.push(node);
    }
  }

  return {
    roots,
    withheldCount: decks.length - nodes.size,
  };
}

export function flattenVisibleMyICloudDeckTree<
  T extends MyICloudDeckTreeItem,
>(
  roots: readonly MyICloudDeckTreeNode<T>[],
  expanded: ReadonlySet<string>,
): MyICloudDeckTreeRow<T>[] {
  const rows: MyICloudDeckTreeRow<T>[] = [];
  const append = (
    nodes: readonly MyICloudDeckTreeNode<T>[],
    depth: number,
  ) => {
    for (const node of nodes) {
      rows.push({
        deck: node.deck,
        depth,
        hasChildren: node.children.length > 0,
      });
      if (expanded.has(node.deck.id)) append(node.children, depth + 1);
    }
  };
  append(roots, 0);
  return rows;
}
