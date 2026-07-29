import { describe, expect, it } from "vitest";

import { validateCardContent } from "@flashcards/domain/content";

import {
  coreLanguageConceptCount,
  coreLanguageLocales,
  coreLanguageTemplateKey,
  createCoreLanguageDeckSeeds,
  stableTemplateUuid,
} from "./core-language-deck.js";

describe("Core Languages deck", () => {
  it("creates one collection and four category decks with 100 concepts", () => {
    const seeds = createCoreLanguageDeckSeeds();

    expect(coreLanguageConceptCount).toBe(100);
    expect(seeds).toHaveLength(5);
    expect(seeds[0]).toMatchObject({
      key: coreLanguageTemplateKey,
      parentKey: null,
      cards: [],
    });
    expect(seeds.slice(1).map((seed) => seed.cards.length)).toEqual([
      40, 20, 15, 25,
    ]);
    expect(
      seeds
        .slice(1)
        .every((seed) => seed.parentKey === coreLanguageTemplateKey),
    ).toBe(true);
  });

  it("uses the same concept once with schema-valid content in all four languages", () => {
    const cards = createCoreLanguageDeckSeeds().flatMap((seed) => seed.cards);

    expect(new Set(cards.map((card) => card.conceptKey)).size).toBe(100);
    for (const card of cards) {
      expect(Object.keys(card.translations).sort()).toEqual(
        [...coreLanguageLocales].sort(),
      );
      validateCardContent(card.front);
      validateCardContent(card.back);
      for (const localized of Object.values(card.translations)) {
        validateCardContent(localized.front);
        validateCardContent(localized.back);
      }
    }
  });

  it("derives stable, scope-specific UUIDs for idempotent updates", () => {
    const first = stableTemplateUuid("deck-a", "water");
    const repeated = stableTemplateUuid("deck-a", "water");
    const anotherDeck = stableTemplateUuid("deck-b", "water");

    expect(first).toBe(repeated);
    expect(first).not.toBe(anotherDeck);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
