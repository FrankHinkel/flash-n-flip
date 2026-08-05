import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  markdownToRichTextDocument,
  parseMarkdownClozes,
  validateCardContent,
} from "@flashcards/domain/content";

import {
  createGermanVerbDeckSeeds,
  germanVerbCardCount,
  germanVerbCount,
  germanVerbTemplateKey,
  germanVerbTenseCount,
} from "./german-verb-deck.js";

const tenseTitles = [
  "Präsens",
  "Perfekt",
  "Präteritum",
  "Plusquamperfekt",
  "Futur I",
  "Futur II",
];

describe("German irregular verb collection", () => {
  it("creates six tense decks and keeps the three present-form drills", () => {
    const seeds = createGermanVerbDeckSeeds();
    expect(seeds).toHaveLength(10);
    expect(seeds[0]).toMatchObject({
      key: germanVerbTemplateKey,
      title: "Konjugation DE",
      parentKey: null,
      cards: [],
    });
    expect(
      seeds.slice(1).every((seed) => seed.parentKey === germanVerbTemplateKey),
    ).toBe(true);
    expect(seeds.slice(1, 7).map((seed) => seed.title)).toEqual(tenseTitles);
    expect(
      seeds.slice(1, 7).every((seed) => seed.studyOrder === "SEQUENTIAL"),
    ).toBe(true);
    expect(
      seeds.slice(7).every((seed) => seed.studyOrder === "SCHEDULED"),
    ).toBe(true);
    expect(seeds.slice(1, 7).map((seed) => seed.cards.length)).toEqual(
      Array.from({ length: germanVerbTenseCount }, () => germanVerbCount + 1),
    );
    expect(seeds.slice(7).map((seed) => seed.cards.length)).toEqual([
      germanVerbCount,
      germanVerbCount,
      germanVerbCount,
    ]);
    expect(seeds.flatMap((seed) => seed.cards)).toHaveLength(
      germanVerbCardCount,
    );
  });

  it("starts every tense with a schema-valid explanation card", () => {
    const tenseDecks = createGermanVerbDeckSeeds().slice(1, 7);
    const timelineIds: string[] = [];
    for (const deck of tenseDecks) {
      const introduction = deck.cards[0]!;
      expect(introduction.key).toBe("introduction");
      validateCardContent(introduction.front);
      validateCardContent(introduction.back);
      expect(hasCardContent(introduction.front)).toBe(true);
      expect(hasCardContent(introduction.back)).toBe(true);
      expect(JSON.stringify(introduction.back)).toContain("Bedeutung");
      expect(JSON.stringify(introduction.back)).toContain("Bildung");
      expect(JSON.stringify(introduction.back)).toContain("Beispiel");
      const timeline = introduction.back.blocks.find(
        (block) => block.type === "graphic",
      );
      expect(timeline?.type).toBe("graphic");
      if (timeline?.type === "graphic") {
        timelineIds.push(timeline.graphicId);
        expect(timeline.label).toContain(`Zeitstrahl ${deck.title}`);
      }
    }
    expect(timelineIds).toEqual([
      "german-tense-present",
      "german-tense-perfect",
      "german-tense-preterite",
      "german-tense-pluperfect",
      "german-tense-future-one",
      "german-tense-future-two",
    ]);
  });

  it("labels every person drill as optional short practice with a two-column task", () => {
    const shortPractice = createGermanVerbDeckSeeds().slice(7);
    expect(shortPractice.map((seed) => seed.title)).toEqual([
      "Kurztraining · Präsens · ich",
      "Kurztraining · Präsens · du",
      "Kurztraining · Präsens · er/sie/es",
    ]);
    expect(shortPractice.every((seed) => seed.optionalStudy)).toBe(true);
    const bringen = shortPractice[0]!.cards.find(
      (item) => item.key === "bringen",
    )!;
    const question = bringen.front.blocks[0]!;
    const answer = bringen.back.blocks[0]!;
    expect(question.type).toBe("markdown");
    expect(answer.type).toBe("markdown");
    if (question.type !== "markdown" || answer.type !== "markdown") return;
    expect(question.source).toContain("## Präsens · „bringen“");
    expect(question.source).toContain(
      "Wähle die richtige Verbform für **ich**.",
    );
    expect(question.source).toContain("^ Pronomen ^ Verbform ^");
    expect(answer.source).toContain("| ich | **bringe** |");
  });

  it("emits schema-valid cards whose cloze answer is the first choice", () => {
    const seeds = createGermanVerbDeckSeeds();
    const cards = seeds.flatMap((seed) => seed.cards);
    for (const item of cards) {
      validateCardContent(item.front);
      validateCardContent(item.back);
    }
    const present = seeds.find((seed) => seed.title === "Präsens")!;
    const cloze = present.cards[1]!.front.blocks[0]!;
    expect(cloze.type).toBe("markdown");
    if (cloze.type === "markdown") {
      const [parsed] = parseMarkdownClozes(cloze.source);
      expect(parsed?.choices[0]).toBe(parsed?.answer);
    }
  });

  it.each([
    ["Präsens", ["gehe", "gehst", "geht", "gehen", "geht", "gehen"]],
    [
      "Perfekt",
      [
        "bin gegangen",
        "bist gegangen",
        "ist gegangen",
        "sind gegangen",
        "seid gegangen",
        "sind gegangen",
      ],
    ],
    ["Präteritum", ["ging", "gingst", "ging", "gingen", "gingt", "gingen"]],
    [
      "Plusquamperfekt",
      [
        "war gegangen",
        "warst gegangen",
        "war gegangen",
        "waren gegangen",
        "wart gegangen",
        "waren gegangen",
      ],
    ],
    [
      "Futur I",
      [
        "werde gehen",
        "wirst gehen",
        "wird gehen",
        "werden gehen",
        "werdet gehen",
        "werden gehen",
      ],
    ],
    [
      "Futur II",
      [
        "werde gegangen sein",
        "wirst gegangen sein",
        "wird gegangen sein",
        "werden gegangen sein",
        "werdet gegangen sein",
        "werden gegangen sein",
      ],
    ],
  ])("builds %s as one sequential conjugation table", (title, forms) => {
    const deck = createGermanVerbDeckSeeds().find(
      (seed) => seed.title === title,
    )!;
    const gehen = deck.cards.find((card) => card.key === "gehen")!;
    const block = gehen.front.blocks[0]!;
    const answerBlock = gehen.back.blocks[0]!;

    expect(block.type).toBe("markdown");
    expect(hasCardContent(gehen.back)).toBe(true);
    expect(answerBlock.type).toBe("markdown");
    if (block.type !== "markdown" || answerBlock.type !== "markdown") return;
    expect(block.revealMode).toBe("SEQUENTIAL");
    expect(block.source).toContain(`^ Singular · ${title} ^^`);
    expect(block.source).toContain(`^ Plural · ${title} ^^`);
    const document = markdownToRichTextDocument(block.source);
    expect(document.content.map((node) => node.type)).toEqual([
      "heading",
      "table",
    ]);
    expect(document.content[0]?.attrs).toEqual({ level: 2 });
    expect(document.content[1]?.content).toHaveLength(8);

    const clozes = parseMarkdownClozes(block.source);
    expect(clozes.map((cloze) => cloze.answer)).toEqual(forms);
    for (const cloze of clozes) {
      expect(cloze.choices[0]).toBe(cloze.answer);
      expect(new Set(cloze.choices).size).toBe(cloze.choices.length);
    }
    const answerDocument = markdownToRichTextDocument(answerBlock.source);
    expect(answerDocument.content.map((node) => node.type)).toEqual([
      "heading",
      "table",
    ]);
    expect(answerDocument.content[1]?.content).toHaveLength(8);
    for (const form of forms) {
      expect(answerBlock.source).toContain(`**${form}**`);
    }
  });
});
