import { languageHubTemplateKey } from "./language-hub";

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

export const isCuratedCloudInventoryValue = (value: unknown): boolean =>
  record(value)?.format === "flash-n-flip.curated-activation.v1";

export const isLocalCloudInventoryDeck = (deck: {
  sourceTemplateKey?: string | null;
}): boolean =>
  !deck.sourceTemplateKey || deck.sourceTemplateKey === languageHubTemplateKey;

export const omitKnownLocalCuratedCloudInventoryDecks = <
  T extends {
    id: string;
  },
>(
  localDecks: readonly {
    id: string;
    sourceTemplateKey?: string | null;
  }[],
  cloudDecks: readonly T[],
): T[] => {
  const curatedDeckIds = new Set(
    localDecks
      .filter((deck) => !isLocalCloudInventoryDeck(deck))
      .map((deck) => deck.id),
  );
  return cloudDecks.filter((deck) => !curatedDeckIds.has(deck.id));
};
