import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  validateCardContent,
} from "@flashcards/domain/content";

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

  it("builds each conjugation as one sequential multiline cloze card", () => {
    const conjugation = createGermanVerbDeckSeeds().find(
      (seed) => seed.title === "Konjugation",
    )!;
    const gehen = conjugation.cards.find((card) => card.key === "gehen")!;
    const block = gehen.front.blocks[0]!;

    expect(block.type).toBe("richText");
    expect(hasCardContent(gehen.back)).toBe(false);
    if (block.type !== "richText") return;
    expect(block.revealMode).toBe("SEQUENTIAL");
    expect(block.document.content.map((node) => node.type)).toEqual([
      "heading",
      "heading",
      "paragraph",
      "paragraph",
      "paragraph",
      "heading",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expect(block.document.content[0]?.attrs).toEqual({ level: 2 });
    expect(block.document.content[1]?.attrs).toEqual({ level: 3 });
    expect(block.document.content[5]?.attrs).toEqual({ level: 3 });

    const clozes = block.document.content.flatMap(
      (node) => node.content?.filter((child) => child.type === "cloze") ?? [],
    );
    const forms = ["gehe", "gehst", "geht", "gehen"];
    expect(clozes).toHaveLength(6);
    for (const cloze of clozes) {
      const attrs = cloze.attrs as {
        answer: string;
        choices: string[];
      };
      expect(attrs.choices[0]).toBe(attrs.answer);
      expect(attrs.choices).toEqual(expect.arrayContaining(forms));
      expect(new Set(attrs.choices).size).toBe(attrs.choices.length);
      expect(attrs.choices.length).toBeGreaterThan(forms.length);
    }
  });
});
