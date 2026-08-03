import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  markdownToRichTextDocument,
  parseMarkdownClozes,
  validateCardContent,
} from "@flashcards/domain/content";

import {
  conjugationCardCount,
  conjugationCollectionTemplateKey,
  conjugationDeckCount,
  conjugationLanguageCount,
  conjugationVerbCount,
  createConjugationCollectionDeckSeeds,
} from "./conjugation-deck.js";

const languageRoots = [
  ["de", "Konjugation DE"],
  ["es", "Konjugation ES"],
  ["en", "Konjugation EN"],
  ["fr", "Konjugation FR"],
] as const;

describe("multilingual conjugation collection", () => {
  it("groups four language collections below one common root", () => {
    const seeds = createConjugationCollectionDeckSeeds();
    expect(seeds).toHaveLength(conjugationDeckCount);
    expect(seeds[0]).toMatchObject({
      key: conjugationCollectionTemplateKey,
      title: "Konjugation",
      parentKey: null,
      contentLocales: ["de", "es", "en", "fr"],
    });
    expect(conjugationLanguageCount).toBe(4);
    expect(conjugationVerbCount).toBe(106);
    expect(conjugationCardCount).toBe(978);

    for (const [locale, title] of languageRoots) {
      const root = seeds.find((seed) => seed.title === title)!;
      expect(root).toMatchObject({
        locale,
        parentKey: conjugationCollectionTemplateKey,
        cards: [],
      });
      const children = seeds.filter((seed) => seed.parentKey === root.key);
      expect(children).toHaveLength(9);
      expect(
        children.slice(0, 6).every((deck) => deck.studyOrder === "SEQUENTIAL"),
      ).toBe(true);
      expect(
        children.slice(6).every((deck) => deck.studyOrder === "SCHEDULED"),
      ).toBe(true);
    }
  });

  it("creates valid localized explanations and conjugation cards", () => {
    const seeds = createConjugationCollectionDeckSeeds();
    for (const seed of seeds) {
      for (const item of seed.cards) {
        validateCardContent(item.front);
        validateCardContent(item.back);
      }
    }

    for (const locale of ["es", "en", "fr"] as const) {
      const root = seeds.find(
        (seed) =>
          seed.locale === locale && seed.title.startsWith("Konjugation"),
      )!;
      const tenseDecks = seeds
        .filter((seed) => seed.parentKey === root.key)
        .slice(0, 6);
      expect(tenseDecks).toHaveLength(6);
      expect(tenseDecks.every((deck) => deck.cards.length === 21)).toBe(true);
      expect(
        seeds
          .filter((seed) => seed.parentKey === root.key)
          .slice(6)
          .every((deck) => deck.cards.length === 20),
      ).toBe(true);
      for (const deck of tenseDecks) {
        const intro = deck.cards[0]!;
        const graphic = intro.back.blocks.find(
          (block) => block.type === "graphic",
        );
        expect(graphic?.type).toBe("graphic");
        if (graphic?.type === "graphic") {
          expect(graphic.graphicId).toMatch(new RegExp(`^${locale}-tense-`));
        }
        expect(hasCardContent(intro.front)).toBe(true);
        expect(hasCardContent(intro.back)).toBe(true);
      }
    }
  });

  it.each([
    [
      "es",
      "ir",
      [
        ["Presente", ["voy", "vas", "va", "vamos", "vais", "van"]],
        [
          "Pretérito perfecto",
          ["he ido", "has ido", "ha ido", "hemos ido", "habéis ido", "han ido"],
        ],
        [
          "Pretérito indefinido",
          ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
        ],
        [
          "Pretérito pluscuamperfecto",
          [
            "había ido",
            "habías ido",
            "había ido",
            "habíamos ido",
            "habíais ido",
            "habían ido",
          ],
        ],
        ["Futuro simple", ["iré", "irás", "irá", "iremos", "iréis", "irán"]],
        [
          "Futuro perfecto",
          [
            "habré ido",
            "habrás ido",
            "habrá ido",
            "habremos ido",
            "habréis ido",
            "habrán ido",
          ],
        ],
      ],
    ],
    [
      "en",
      "go",
      [
        ["Simple Present", ["go", "go", "goes", "go", "go", "go"]],
        [
          "Present Perfect",
          [
            "have gone",
            "have gone",
            "has gone",
            "have gone",
            "have gone",
            "have gone",
          ],
        ],
        ["Simple Past", ["went", "went", "went", "went", "went", "went"]],
        [
          "Past Perfect",
          [
            "had gone",
            "had gone",
            "had gone",
            "had gone",
            "had gone",
            "had gone",
          ],
        ],
        [
          "Future Simple",
          ["will go", "will go", "will go", "will go", "will go", "will go"],
        ],
        [
          "Future Perfect",
          [
            "will have gone",
            "will have gone",
            "will have gone",
            "will have gone",
            "will have gone",
            "will have gone",
          ],
        ],
      ],
    ],
    [
      "fr",
      "aller",
      [
        ["Présent", ["vais", "vas", "va", "allons", "allez", "vont"]],
        [
          "Passé composé",
          [
            "suis allé(e)",
            "es allé(e)",
            "est allé(e)",
            "sommes allé(e)s",
            "êtes allé(e)s",
            "sont allé(e)s",
          ],
        ],
        [
          "Imparfait",
          ["allais", "allais", "allait", "allions", "alliez", "allaient"],
        ],
        [
          "Plus-que-parfait",
          [
            "étais allé(e)",
            "étais allé(e)",
            "était allé(e)",
            "étions allé(e)s",
            "étiez allé(e)s",
            "étaient allé(e)s",
          ],
        ],
        ["Futur simple", ["irai", "iras", "ira", "irons", "irez", "iront"]],
        [
          "Futur antérieur",
          [
            "serai allé(e)",
            "seras allé(e)",
            "sera allé(e)",
            "serons allé(e)s",
            "serez allé(e)s",
            "seront allé(e)s",
          ],
        ],
      ],
    ],
  ] as const)(
    "builds all six %s conjugation tables",
    (locale, infinitive, tenses) => {
      const seeds = createConjugationCollectionDeckSeeds();
      for (const [title, expectedForms] of tenses) {
        const deck = seeds.find(
          (seed) => seed.locale === locale && seed.title === title,
        )!;
        const item = deck.cards.find(
          (candidate) => candidate.key === infinitive,
        )!;
        const block = item.front.blocks[0]!;
        expect(block.type).toBe("markdown");
        expect(hasCardContent(item.back)).toBe(false);
        if (block.type !== "markdown") continue;
        expect(block.revealMode).toBe("SEQUENTIAL");
        const document = markdownToRichTextDocument(block.source);
        expect(document.content.map((node) => node.type)).toEqual([
          "heading",
          "table",
        ]);
        const clozes = parseMarkdownClozes(block.source);
        expect(clozes.map((cloze) => cloze.answer)).toEqual(expectedForms);
        expect(clozes).toHaveLength(6);
        for (const cloze of clozes) {
          expect(cloze.choices[0]).toBe(cloze.answer);
          expect(new Set(cloze.choices).size).toBe(cloze.choices.length);
        }
      }
    },
  );
});
