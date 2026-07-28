import { describe, expect, it } from "vitest";

import { validateCardContent } from "@flashcards/domain/content";

import {
  createGermanVerbDeckSeeds,
  germanVerbCount,
  germanVerbTemplateKey,
} from "./german-verb-deck.js";

describe("German irregular present-tense deck", () => {
  it("creates a root collection with four complete subdecks", () => {
    const seeds = createGermanVerbDeckSeeds();
    expect(seeds).toHaveLength(5);
    expect(seeds[0]).toMatchObject({
      key: germanVerbTemplateKey,
      parentKey: null,
      cards: [],
    });
    expect(
      seeds.slice(1).every((seed) => seed.parentKey === germanVerbTemplateKey),
    ).toBe(true);
    expect(seeds.slice(1).map((seed) => seed.cards.length)).toEqual([
      germanVerbCount,
      germanVerbCount,
      germanVerbCount,
      germanVerbCount,
    ]);
  });

  it("emits schema-valid cards whose cloze answer is the first choice", () => {
    const cards = createGermanVerbDeckSeeds().flatMap((seed) => seed.cards);
    for (const item of cards) {
      validateCardContent(item.front);
      validateCardContent(item.back);
    }
    const cloze = createGermanVerbDeckSeeds()[2]!.cards[0]!.front.blocks[0]!;
    expect(cloze.type).toBe("richText");
    if (cloze.type === "richText") {
      const node = cloze.document.content[0]?.content?.find(
        (candidate) => candidate.type === "cloze",
      );
      const attrs = node?.attrs as
        { answer: string; choices: string[] } | undefined;
      expect(attrs?.choices[0]).toBe(attrs?.answer);
    }
  });
});
