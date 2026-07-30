import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  markdownToRichTextDocument,
  parseMarkdownClozes,
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
    expect(cloze.type).toBe("markdown");
    if (cloze.type === "markdown") {
      const [parsed] = parseMarkdownClozes(cloze.source);
      expect(parsed?.choices[0]).toBe(parsed?.answer);
    }
  });

  it("builds each conjugation as one sequential multiline cloze card", () => {
    const conjugation = createGermanVerbDeckSeeds().find(
      (seed) => seed.title === "Konjugation",
    )!;
    const gehen = conjugation.cards.find((card) => card.key === "gehen")!;
    const block = gehen.front.blocks[0]!;

    expect(block.type).toBe("markdown");
    expect(hasCardContent(gehen.back)).toBe(false);
    if (block.type !== "markdown") return;
    expect(block.revealMode).toBe("SEQUENTIAL");
    expect(block.source).toContain("^ Singular ^^");
    expect(block.source).toContain("^ Plural ^^");
    expect(block.source).not.toContain("### Singular");
    const document = markdownToRichTextDocument(block.source);
    expect(document.content.map((node) => node.type)).toEqual([
      "heading",
      "table",
    ]);
    expect(document.content[0]?.attrs).toEqual({ level: 2 });
    expect(document.content[1]?.content).toHaveLength(8);

    const clozes = parseMarkdownClozes(block.source);
    const forms = ["gehe", "gehst", "geht", "gehen"];
    expect(clozes).toHaveLength(6);
    for (const cloze of clozes) {
      expect(cloze.choices[0]).toBe(cloze.answer);
      expect(cloze.choices).toEqual(expect.arrayContaining(forms));
      expect(new Set(cloze.choices).size).toBe(cloze.choices.length);
      expect(cloze.choices.length).toBeGreaterThan(forms.length);
    }
  });
});
