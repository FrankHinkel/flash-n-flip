import { describe, expect, it } from "vitest";

import type { AnkiImportProfile } from "@flashcards/domain/anki-import-profile";

import {
  applyCustomAnkiImportProfile,
  compileAnkiProfileSide,
  compileAnkiProfileTemplate,
} from "./anki-import-profile.js";
import type { ParsedAnkiPackage } from "./anki-package.js";

const profile = (): AnkiImportProfile => ({
  schemaVersion: 2,
  id: "2c50b4d9-69b2-4d30-9f39-e0263d9922f1",
  name: "Language tables",
  description: "",
  createdAt: "2026-08-08T10:00:00.000Z",
  updatedAt: "2026-08-08T10:00:00.000Z",
  rules: [
    {
      id: "language-note",
      noteTypeName: "Languages",
      requiredFields: ["Lang", "Translation"],
      noteTypeSignature: null,
      sourceDeckPath: null,
      sourceTemplate: null,
      outputs: [
        {
          id: "forward",
          name: "Language → translation",
          frontTemplate: "[[Lang]]",
          backTemplate:
            "| Sprache |[[Lang]] |\n| Übersetzung |[[Translation]] |",
          frontSections: [],
          backSections: [],
          requiredNonEmptyFields: ["Lang", "Translation"],
          targetDeckPath: null,
          direction: "SOURCE_TO_TARGET",
          linkedToPrevious: false,
        },
        {
          id: "cloze",
          name: "Cloze",
          frontTemplate: "Übersetzung: {{[[Translation]]}}",
          backTemplate: "[[Lang]]",
          frontSections: [],
          backSections: [],
          requiredNonEmptyFields: ["Translation"],
          targetDeckPath: null,
          direction: "TARGET_TO_SOURCE",
          linkedToPrevious: true,
        },
      ],
    },
  ],
});

const parsedPackage = (): ParsedAnkiPackage => ({
  collectionTitle: "Languages",
  packageVersion: "legacy",
  warnings: [],
  media: [],
  noteTypes: [
    {
      sourceNoteTypeId: "100",
      name: "Languages",
      isCloze: false,
      fields: ["Lang", "Translation"],
      templates: [
        {
          ord: 0,
          name: "Card 1",
          questionFields: ["Lang"],
          answerFields: ["Translation"],
        },
      ],
    },
  ],
  decks: [
    {
      sourceDeckId: "200",
      title: "Languages",
      path: ["Languages"],
      cards: [
        {
          sourceCardId: "300",
          sourceNoteId: "400",
          sourceNoteTypeId: "100",
          sourceTemplateOrd: 0,
          sourceFields: {
            Lang: { blocks: [{ type: "text", text: "bonjour" }] },
            Translation: { blocks: [{ type: "text", text: "hello" }] },
          },
          sourceFieldText: { Lang: "bonjour", Translation: "hello" },
          front: { blocks: [{ type: "text", text: "bonjour" }] },
          back: { blocks: [{ type: "text", text: "hello" }] },
          tags: [],
        },
      ],
    },
  ],
});

describe("Anki import profiles", () => {
  it("creates several safe cards from one note with Wiki tables and clozes", () => {
    const result = applyCustomAnkiImportProfile(parsedPackage(), profile(), {
      sourceLocale: "fr",
      targetLocale: "en",
    });

    expect(result.decks[0]?.cards).toHaveLength(2);
    expect(result.decks[0]?.cards[0]).toMatchObject({
      questionLocale: "fr",
      answerLocale: "en",
      linkedToPrevious: false,
    });
    expect(JSON.stringify(result.decks[0]?.cards[0]?.back)).toContain(
      '"type":"table"',
    );
    expect(JSON.stringify(result.decks[0]?.cards[1]?.front)).toContain(
      '"type":"cloze"',
    );
    expect(result.decks[0]?.cards[1]).toMatchObject({
      questionLocale: "en",
      answerLocale: "fr",
      linkedToPrevious: true,
    });
  });

  it("inserts hostile field values as inert text instead of parsing them", () => {
    const content = compileAnkiProfileTemplate(
      "| Value |[[Field]] |",
      new Map([["Field", "| <script>alert(1)</script> {{1:injected}}"]]),
    );
    const serialized = JSON.stringify(content);

    expect(serialized).toContain("<script>alert(1)</script>");
    expect(serialized).toContain("{{1:injected}}");
    expect(serialized.match(/\"type\":\"table\"/g)).toHaveLength(1);
    expect(serialized).not.toContain('"type":"cloze"');
  });

  it("inserts standalone media fields as already-sanitized typed blocks", () => {
    const content = compileAnkiProfileSide(
      "[[Picture]]",
      new Map([
        [
          "Picture",
          {
            text: "![not reparsed](https://example.invalid/tracker.png)",
            content: {
              blocks: [
                {
                  type: "importImage",
                  sourceName: "safe.png",
                  alt: "Map",
                  decorative: false,
                },
              ],
            },
          },
        ],
      ]),
    );

    expect(content.blocks).toEqual([
      {
        type: "importImage",
        sourceName: "safe.png",
        alt: "Map",
        decorative: false,
      },
    ]);
    expect(JSON.stringify(content)).not.toContain("example.invalid");
  });

  it("uses template-specific overrides and deterministic target decks", () => {
    const source = parsedPackage();
    source.noteTypes[0]!.templates.push({
      ord: 1,
      name: "Reverse",
      questionFields: ["Translation"],
      answerFields: ["Lang"],
    });
    source.decks[0]!.cards.push({
      ...structuredClone(source.decks[0]!.cards[0]!),
      sourceCardId: "301",
      sourceTemplateOrd: 1,
      sourceTemplateName: "Reverse",
    });
    const candidate = profile();
    candidate.rules = [
      {
        ...candidate.rules[0]!,
        outputs: [candidate.rules[0]!.outputs[0]!],
      },
      {
        ...candidate.rules[0]!,
        id: "reverse-template",
        sourceTemplate: { ord: 1 },
        outputs: [
          {
            ...candidate.rules[0]!.outputs[1]!,
            id: "reverse",
            targetDeckPath: ["Languages", "Reverse"],
            backSections: [
              {
                id: "translation-note",
                template: "Translation: [[Translation]]",
                whenAnyNonEmptyFields: ["Translation"],
                whenAllNonEmptyFields: [],
              },
            ],
          },
        ],
      },
    ];

    const result = applyCustomAnkiImportProfile(source, candidate, {
      sourceLocale: "fr",
      targetLocale: "en",
    });

    expect(result.decks.map((deck) => deck.path)).toEqual([
      ["Languages"],
      ["Languages", "Reverse"],
    ]);
    expect(result.decks.flatMap((deck) => deck.cards)).toHaveLength(2);
    expect(result.decks[1]?.cards[0]).toMatchObject({
      sourceOriginalTemplateOrd: 1,
      profileRuleId: "reverse-template",
      profileOutputId: "reverse",
    });
  });

  it("rejects unknown fields before import", () => {
    expect(() => compileAnkiProfileTemplate("[[Missing]]", new Map())).toThrow(
      "Unbekanntes Anki-Feld",
    );
  });

  it("rejects executable markup authored in a profile template", () => {
    expect(() =>
      compileAnkiProfileTemplate(
        "<script>alert(1)</script> [[Field]]",
        new Map([["Field", "safe"]]),
      ),
    ).toThrow("Raw HTML");
  });
});
