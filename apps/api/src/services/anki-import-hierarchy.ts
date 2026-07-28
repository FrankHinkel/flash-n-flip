import type { ParsedAnkiDeck } from "./anki-package.js";

export type AnkiImportHierarchyNode = {
  key: string;
  parentKey: string | null;
  title: string;
};

export type AnkiImportHierarchy = {
  collectionKey: string;
  nodes: AnkiImportHierarchyNode[];
  nodeKeyBySourceDeckId: Map<string, string>;
};

const COLLECTION_KEY = "$collection";

const pathKey = (segments: string[]): string =>
  `$deck:${segments.map((segment) => `${segment.length}:${segment}`).join("/")}`;

export const createAnkiImportHierarchy = (
  collectionTitle: string,
  decks: Pick<ParsedAnkiDeck, "sourceDeckId" | "path" | "title">[],
): AnkiImportHierarchy => {
  const nodes: AnkiImportHierarchyNode[] = [
    { key: COLLECTION_KEY, parentKey: null, title: collectionTitle },
  ];
  const known = new Set([COLLECTION_KEY]);
  const nodeKeyBySourceDeckId = new Map<string, string>();
  const commonRoot =
    decks.length > 0 && decks.every((deck) => deck.path[0] === collectionTitle);

  for (const deck of decks) {
    const originalPath = deck.path.length ? deck.path : [deck.title];
    const path = commonRoot ? originalPath.slice(1) : originalPath;
    const effectivePath = path.length ? path : ["Cards"];
    let parentKey = COLLECTION_KEY;
    for (let index = 0; index < effectivePath.length; index += 1) {
      const segments = effectivePath.slice(0, index + 1);
      const key = pathKey(segments);
      if (!known.has(key)) {
        nodes.push({
          key,
          parentKey,
          title: effectivePath[index]!,
        });
        known.add(key);
      }
      parentKey = key;
    }
    nodeKeyBySourceDeckId.set(deck.sourceDeckId, parentKey);
  }

  return {
    collectionKey: COLLECTION_KEY,
    nodes,
    nodeKeyBySourceDeckId,
  };
};
