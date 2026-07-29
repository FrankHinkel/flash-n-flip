import type { GermanVerbDeckSeed } from "./german-verb-deck.js";

const templateTagPrefix = "fnf-template-card:";

export const germanVerbCardTag = (
  deckTemplateKey: string,
  cardKey: string,
): string => `${templateTagPrefix}${deckTemplateKey}:${cardKey}`;

export type ExistingGermanVerbCard = {
  cardId: string;
  noteId: string;
  position: number;
  tags: string[];
};

export type GermanVerbCardSyncEntry = {
  seed: GermanVerbDeckSeed["cards"][number];
  existing: ExistingGermanVerbCard | null;
  tag: string;
  position: number;
};

export const planGermanVerbCardSync = (
  seed: GermanVerbDeckSeed,
  existingCards: readonly ExistingGermanVerbCard[],
): GermanVerbCardSyncEntry[] => {
  const sorted = [...existingCards].sort(
    (left, right) =>
      left.position - right.position || left.cardId.localeCompare(right.cardId),
  );
  const byTag = new Map<string, ExistingGermanVerbCard>();
  for (const existing of sorted) {
    for (const tag of existing.tags) {
      if (tag.startsWith(templateTagPrefix) && !byTag.has(tag)) {
        byTag.set(tag, existing);
      }
    }
  }
  const legacy = sorted.filter((existing) =>
    existing.tags.every((tag) => !tag.startsWith(templateTagPrefix)),
  );
  const usedCardIds = new Set<string>();

  return seed.cards.map((card, index) => {
    const tag = germanVerbCardTag(seed.key, card.key);
    const tagged = byTag.get(tag);
    const fallback = legacy.find(
      (existing) => !usedCardIds.has(existing.cardId),
    );
    const existing =
      tagged && !usedCardIds.has(tagged.cardId) ? tagged : (fallback ?? null);
    if (existing) usedCardIds.add(existing.cardId);
    return {
      seed: card,
      existing,
      tag,
      position: index + 1,
    };
  });
};
