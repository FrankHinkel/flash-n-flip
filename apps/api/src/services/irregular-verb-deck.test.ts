import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  markdownToRichTextDocument,
  parseMarkdownClozes,
  validateCardContent,
} from "@flashcards/domain/content";

import {
  createIrregularVerbDeckSeeds,
  irregularVerbCardCount,
  irregularVerbCollectionTemplateKey,
  irregularVerbCount,
  irregularVerbDeckCount,
  irregularVerbLanguageCount,
} from "./irregular-verb-deck.js";

describe("Irregular Verbs collection", () => {
  it("creates one root and four language decks with 60 verbs each", () => {
    const seeds = createIrregularVerbDeckSeeds();
    expect(seeds).toHaveLength(irregularVerbDeckCount);
    expect(seeds[0]).toMatchObject({
      key: irregularVerbCollectionTemplateKey,
      title: "Irregular Verbs",
      parentKey: null,
      cards: [],
    });
    expect(irregularVerbLanguageCount).toBe(4);
    expect(irregularVerbCount).toBe(240);
    expect(irregularVerbCardCount).toBe(244);
    expect(seeds.slice(1).map((seed) => seed.title)).toEqual([
      "Irregular Verbs DE",
      "Irregular Verbs EN",
      "Irregular Verbs ES",
      "Irregular Verbs FR",
    ]);
    for (const seed of seeds.slice(1)) {
      expect(seed.parentKey).toBe(irregularVerbCollectionTemplateKey);
      expect(seed.studyOrder).toBe("SEQUENTIAL");
      expect(seed.cards).toHaveLength(61);
      expect(seed.cards[0]?.key).toBe("introduction");
      expect(new Set(seed.cards.slice(1).map((card) => card.key)).size).toBe(
        60,
      );
    }
  });

  it("emits safe tables with six unique choices for every missing form", () => {
    const seeds = createIrregularVerbDeckSeeds();
    for (const seed of seeds.slice(1)) {
      for (const item of seed.cards) {
        validateCardContent(item.front);
        validateCardContent(item.back);
      }
      expect(hasCardContent(seed.cards[0]!.back)).toBe(true);
      for (const item of seed.cards.slice(1)) {
        expect(hasCardContent(item.back)).toBe(true);
        const block = item.front.blocks[0]!;
        const answerBlock = item.back.blocks[0]!;
        expect(block.type).toBe("markdown");
        expect(answerBlock.type).toBe("markdown");
        if (block.type !== "markdown" || answerBlock.type !== "markdown") {
          continue;
        }
        expect(block.revealMode).toBe("SEQUENTIAL");
        const document = markdownToRichTextDocument(block.source);
        expect(document.content.map((node) => node.type)).toEqual([
          "heading",
          "table",
        ]);
        expect(document.content[1]?.content).toHaveLength(2);
        const clozes = parseMarkdownClozes(block.source);
        expect(clozes).toHaveLength(
          seed.locale === "de" || seed.locale === "en" ? 2 : 3,
        );
        for (const cloze of clozes) {
          expect(cloze.choices).toHaveLength(6);
          expect(cloze.choices[0]).toBe(cloze.answer);
          expect(new Set(cloze.choices).size).toBe(6);
          expect(cloze.choices.every((choice) => !choice.includes(" "))).toBe(
            true,
          );
        }
        const answerDocument = markdownToRichTextDocument(answerBlock.source);
        expect(answerDocument.content.map((node) => node.type)).toEqual([
          "heading",
          "table",
        ]);
        expect(answerDocument.content[1]?.content).toHaveLength(
          clozes.length + 2,
        );
        expect(answerBlock.source).toContain(`**${item.key}**`);
        for (const cloze of clozes) {
          expect(answerBlock.source).toContain(`**${cloze.answer}**`);
        }
      }
    }
  });

  it.each([
    ["de", "nehmen", ["nahm", "genommen"]],
    ["en", "take", ["took", "taken"]],
    ["es", "hacer", ["hago", "hice", "hecho"]],
    ["fr", "prendre", ["prends", "prenons", "pris"]],
  ] as const)(
    "shares the expected %s principal parts",
    (locale, infinitive, forms) => {
      const deck = createIrregularVerbDeckSeeds().find(
        (seed) => seed.locale === locale && seed.parentKey,
      )!;
      const item = deck.cards.find((card) => card.key === infinitive)!;
      const block = item.front.blocks[0]!;
      expect(block.type).toBe("markdown");
      if (block.type !== "markdown") return;
      expect(
        parseMarkdownClozes(block.source).map((cloze) => cloze.answer),
      ).toEqual(forms);
    },
  );

  it("shows one compact answer example for every principal part", () => {
    const cases = [
      ["Irregular Verbs DE", "nehmen", "Ich habe **genommen**."],
      ["Irregular Verbs EN", "take", "I have **taken**."],
      ["Irregular Verbs ES", "hacer", "He **hecho**."],
      ["Irregular Verbs FR", "prendre", "J’ai **pris**."],
    ] as const;
    const seeds = createIrregularVerbDeckSeeds();
    for (const [deckTitle, infinitive, expectedSentence] of cases) {
      const item = seeds
        .find((seed) => seed.title === deckTitle)!
        .cards.find((card) => card.key === infinitive)!;
      const block = item.back.blocks[0]!;
      expect(block.type).toBe("markdown");
      if (block.type === "markdown") {
        expect(block.source).toContain(expectedSentence);
      }
    }
  });

  it("uses deliberately plausible traps for take, took, taken", () => {
    const deck = createIrregularVerbDeckSeeds().find(
      (seed) => seed.title === "Irregular Verbs EN",
    )!;
    const take = deck.cards.find((card) => card.key === "take")!;
    const block = take.front.blocks[0]!;
    expect(block.type).toBe("markdown");
    if (block.type !== "markdown") return;
    const [past, participle] = parseMarkdownClozes(block.source);
    expect(past?.choices).toEqual([
      "took",
      "taked",
      "toke",
      "taken",
      "tooked",
      "taking",
    ]);
    expect(participle?.choices).toEqual([
      "taken",
      "takened",
      "took",
      "taked",
      "tooken",
      "taking",
    ]);
  });
});
