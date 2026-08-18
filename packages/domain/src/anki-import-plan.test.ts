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
