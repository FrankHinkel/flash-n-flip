import type { ParsedAnkiCard, ParsedAnkiDeck } from "./anki-import-types.js";

export const maximumGeneratedAnkiSubdecks = 1_000;

export type AnkiImportHierarchyNode = {
  key: string;
  parentKey: string | null;
  title: string;
  sourceFieldName?: string;
};

export type AnkiImportHierarchy = {
  collectionKey: string;
  nodes: AnkiImportHierarchyNode[];
  nodeKeyBySourceDeckId: Map<string, string>;
  nodeKeyByCard: Map<ParsedAnkiCard, string>;
  generatedNodeCount: number;
};

export type AnkiSourceHierarchyPreview = {
  detected: boolean;
  maximumDepth: number;
  decks: Array<{
    sourceDeckId: string;
    path: string[];
    cardCount: number;
  }>;
  paths: Array<{
    path: string[];
    cardCount: number;
  }>;
  hiddenPathCount: number;
};

const COLLECTION_KEY = "$collection";

const pathKey = (segments: string[]): string =>
  `$deck:${segments.map((segment) => `${segment.length}:${segment}`).join("/")}`;

const subdeckKey = (
  parentKey: string,
  fieldName: string,
  title: string,
): string =>
  `$field:${[parentKey, fieldName, title]
    .map((value) => `${value.length}:${value}`)
    .join("/")}`;

const subdeckTitle = (value: string | undefined, fieldName: string): string => {
  const title = value
    ?.replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return title || `Ohne ${fieldName}`.slice(0, 120);
};

const effectiveDeckPaths = (
  collectionTitle: string,
  decks: Array<Pick<ParsedAnkiDeck, "path" | "title">>,
): string[][] => {
  const commonRoot =
    decks.length > 0 && decks.every((deck) => deck.path[0] === collectionTitle);
  return decks.map((deck) => {
    const originalPath = deck.path.length ? deck.path : [deck.title];
    const path = commonRoot ? originalPath.slice(1) : originalPath;
    return path.length ? path : ["Cards"];
  });
};

export const createAnkiSourceHierarchyPreview = (
  collectionTitle: string,
  decks: Array<
    Pick<ParsedAnkiDeck, "sourceDeckId" | "path" | "title"> &
      Partial<Pick<ParsedAnkiDeck, "cards">>
  >,
  maximumPreviewPaths = 12,
): AnkiSourceHierarchyPreview => {
  const paths = effectiveDeckPaths(collectionTitle, decks);
  const sortedPaths = decks
    .map((deck, index) => ({
      sourceDeckId: deck.sourceDeckId,
      path: paths[index]!,
      cardCount: deck.cards?.length ?? 0,
    }))
    .sort((left, right) =>
      left.path.join("\u0000").localeCompare(right.path.join("\u0000"), "de", {
        numeric: true,
        sensitivity: "base",
      }),
    );
  const previewPathCount = Math.max(0, maximumPreviewPaths);

  return {
    detected: decks.length > 1 || decks.some((deck) => deck.path.length > 1),
    maximumDepth: paths.reduce(
      (maximum, path) => Math.max(maximum, path.length),
      0,
    ),
    decks: sortedPaths,
    paths: sortedPaths
      .slice(0, previewPathCount)
      .map(({ path, cardCount }) => ({
        path,
        cardCount,
      })),
    hiddenPathCount: Math.max(0, sortedPaths.length - previewPathCount),
  };
};

export const createAnkiImportHierarchy = (
  collectionTitle: string,
  decks: Array<
    Pick<ParsedAnkiDeck, "sourceDeckId" | "path" | "title"> &
      Partial<Pick<ParsedAnkiDeck, "cards">>
  >,
  subdeckFields: Record<string, string[]> = {},
  options: { flatten?: boolean } = {},
): AnkiImportHierarchy => {
  const nodes: AnkiImportHierarchyNode[] = [
    { key: COLLECTION_KEY, parentKey: null, title: collectionTitle },
  ];
  const known = new Set([COLLECTION_KEY]);
  const nodeKeyBySourceDeckId = new Map<string, string>();
  const nodeKeyByCard = new Map<ParsedAnkiCard, string>();
  if (options.flatten) {
    for (const deck of decks) {
      nodeKeyBySourceDeckId.set(deck.sourceDeckId, COLLECTION_KEY);
      for (const card of deck.cards ?? []) {
        nodeKeyByCard.set(card, COLLECTION_KEY);
      }
    }
    return {
      collectionKey: COLLECTION_KEY,
      nodes,
      nodeKeyBySourceDeckId,
      nodeKeyByCard,
      generatedNodeCount: 0,
    };
  }
  const paths = effectiveDeckPaths(collectionTitle, decks);

  for (const [deckIndex, deck] of decks.entries()) {
    const effectivePath = paths[deckIndex]!;
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

  let generatedNodeCount = 0;
  for (const deck of decks) {
    const sourceDeckKey = nodeKeyBySourceDeckId.get(deck.sourceDeckId)!;
    for (const card of deck.cards ?? []) {
      let parentKey = sourceDeckKey;
      const sourceNoteTypeId = card.sourceNoteTypeId ?? "";
      for (const fieldName of subdeckFields[sourceNoteTypeId] ?? []) {
        const title = subdeckTitle(
          card.sourceFieldText?.[fieldName],
          fieldName,
        );
        const key = subdeckKey(parentKey, fieldName, title);
        if (!known.has(key)) {
          generatedNodeCount += 1;
          if (generatedNodeCount > maximumGeneratedAnkiSubdecks) {
            throw new Error(
              `Die ausgewählten Anki-Felder würden mehr als ${maximumGeneratedAnkiSubdecks.toLocaleString("de-DE")} Unterdecks erzeugen. Bitte wähle gröbere Felder.`,
            );
          }
          nodes.push({ key, parentKey, title, sourceFieldName: fieldName });
          known.add(key);
        }
        parentKey = key;
      }
      nodeKeyByCard.set(card, parentKey);
    }
  }

  return {
    collectionKey: COLLECTION_KEY,
    nodes,
    nodeKeyBySourceDeckId,
    nodeKeyByCard,
    generatedNodeCount,
  };
};
