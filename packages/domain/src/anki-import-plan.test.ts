import { describe, expect, it } from "vitest";

import type { ParsedAnkiPackage } from "./anki-import-types.js";
import { prepareAnkiCompatiblePackage } from "./anki-import-plan.js";

const parsedPackage = (): ParsedAnkiPackage => ({
  collectionTitle: "Richtungen",
  decks: [
    {
      sourceDeckId: "deck",
      title: "Deck",
      path: ["Deck"],
      cards: [
        {
          sourceCardId: "forward",
          sourceNoteId: "note",
          sourceTemplateOrd: 0,
          sourceTemplateName: "Karte 1",
          front: { blocks: [{ type: "text", text: "Frage" }] },
          back: { blocks: [{ type: "text", text: "Antwort" }] },
          tags: [],
        },
        {
          sourceCardId: "reverse",
          sourceNoteId: "note",
          sourceTemplateOrd: 1,
          sourceTemplateName: "Karte 2",
          front: { blocks: [{ type: "text", text: "Antwort" }] },
          back: { blocks: [{ type: "text", text: "Frage" }] },
          tags: [],
        },
        {
          sourceCardId: "independent",
          sourceNoteId: "note",
          sourceTemplateOrd: 2,
          sourceTemplateName: "Zusatzfrage",
          front: { blocks: [{ type: "text", text: "Zusatzfrage" }] },
          back: { blocks: [{ type: "text", text: "Zusatzantwort" }] },
          tags: [],
        },
      ],
    },
  ],
  media: [],
  warnings: [],
  packageVersion: "latest",
  noteTypes: [],
});

describe("automatic Anki card direction", () => {
  it("suspends only exact reverse siblings by default", () => {
    const prepared = prepareAnkiCompatiblePackage(parsedPackage(), {
      sourceLocale: "de",
      targetLocale: "de",
    }).package;

    expect(prepared.decks[0]!.cards.map((card) => card.suspended)).toEqual([
      undefined,
      true,
      undefined,
    ]);
    expect(prepared.warnings).toContainEqual(
      expect.stringContaining("1 erkannte Rückwärtskarten"),
    );
  });

  it("keeps reverse siblings active after explicit opt-in", () => {
    const prepared = prepareAnkiCompatiblePackage(
      parsedPackage(),
      { sourceLocale: "de", targetLocale: "de" },
      { includeReverseCards: true },
    ).package;

    expect(prepared.decks[0]!.cards.every((card) => !card.suspended)).toBe(
      true,
    );
  });
});

describe("preserved Anki cloze semantics", () => {
  it("keeps ordinals structured and retains answer-only extra fields", () => {
    const source = parsedPackage();
    source.noteTypes = [
      {
        sourceNoteTypeId: "cloze-model",
        name: "Cloze",
        isCloze: true,
        fields: ["Text", "Back Extra"],
        templates: [
          {
            ord: 0,
            name: "Cloze",
            questionFields: ["Text"],
            answerFields: ["Text", "Back Extra"],
          },
        ],
      },
    ];
    source.decks[0]!.cards = [0, 1].map((ordinal) => ({
      sourceCardId: `cloze-${ordinal}`,
      sourceNoteId: "cloze-note",
      sourceNoteTypeId: "cloze-model",
      sourceTemplateOrd: 0,
      sourceClozeOrdinal: ordinal,
      sourceTemplateName: "Cloze",
      sourceFieldText: {
        Text: "The diagonal elements of a {{c1::skew-symmetrical}} matrix are always {{c2::zero}}.",
        "Back Extra": "Matrix note",
      },
      sourceFields: {
        Text: { blocks: [] },
        "Back Extra": {
          blocks: [{ type: "text" as const, text: "Matrix note" }],
        },
      },
      front: { blocks: [{ type: "text" as const, text: "legacy front" }] },
      back: { blocks: [{ type: "text" as const, text: "legacy back" }] },
      tags: [],
    }));

    const prepared = prepareAnkiCompatiblePackage(source, {
      sourceLocale: "en",
      targetLocale: "en",
    }).package;
    const cards = prepared.decks[0]!.cards;

    expect(cards).toHaveLength(2);
    expect(cards[0]?.front.blocks).toEqual([
      expect.objectContaining({
        type: "cloze",
        presentation: "ANKI",
        activeDeletionId: 1,
      }),
    ]);
    expect(cards[1]?.front.blocks).toEqual([
      expect.objectContaining({
        type: "cloze",
        presentation: "ANKI",
        activeDeletionId: 2,
      }),
    ]);
    expect(cards[0]?.back.blocks).toEqual([
      expect.objectContaining({ type: "cloze", activeDeletionId: 1 }),
      { type: "text", text: "Matrix note" },
    ]);
    expect(cards.every((card) => !card.suspended)).toBe(true);
  });

  it("does not append the generated unsupported-content placeholder to a cloze answer", () => {
    const source = parsedPackage();
    source.noteTypes = [
      {
        sourceNoteTypeId: "cloze-model",
        name: "Cloze",
        isCloze: true,
        fields: ["Text", "Back Extra"],
        templates: [
          {
            ord: 0,
            name: "Cloze",
            questionFields: ["Text"],
            answerFields: ["Text", "Back Extra"],
          },
        ],
      },
    ];
    source.decks[0]!.cards = [
      {
        sourceCardId: "cloze-0",
        sourceNoteId: "cloze-note",
        sourceNoteTypeId: "cloze-model",
        sourceTemplateOrd: 0,
        sourceClozeOrdinal: 0,
        sourceTemplateName: "Cloze",
        sourceFieldText: {
          Text: "A {{c1::matrix}} is shown.",
          "Back Extra": "",
        },
        sourceFields: {
          Text: { blocks: [] },
          "Back Extra": {
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "Nicht unterstützter Anki-Inhalt.",
              },
            ],
          },
        },
        front: { blocks: [{ type: "text", text: "legacy front" }] },
        back: { blocks: [{ type: "text", text: "legacy back" }] },
        tags: [],
      },
    ];

    const prepared = prepareAnkiCompatiblePackage(source, {
      sourceLocale: "en",
      targetLocale: "en",
    }).package;

    expect(prepared.decks[0]!.cards[0]!.back.blocks).toEqual([
      expect.objectContaining({ type: "cloze", activeDeletionId: 1 }),
    ]);
  });
});
