import type { ParsedAnkiCard, ParsedAnkiDeck } from "./anki-package.js";

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

export const createAnkiImportHierarchy = (
  collectionTitle: string,
  decks: Array<
    Pick<ParsedAnkiDeck, "sourceDeckId" | "path" | "title"> &
      Partial<Pick<ParsedAnkiDeck, "cards">>
  >,
  subdeckFields: Record<string, string[]> = {},
): AnkiImportHierarchy => {
  const nodes: AnkiImportHierarchyNode[] = [
    { key: COLLECTION_KEY, parentKey: null, title: collectionTitle },
  ];
  const known = new Set([COLLECTION_KEY]);
  const nodeKeyBySourceDeckId = new Map<string, string>();
  const nodeKeyByCard = new Map<ParsedAnkiCard, string>();
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
