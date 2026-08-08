import { describe, expect, it } from "vitest";

import type { AnkiImportProfile } from "@flashcards/domain/anki-import-profile";

import {
  applyCustomAnkiImportProfile,
  compileAnkiProfileTemplate,
} from "./anki-import-profile.js";
import type { ParsedAnkiPackage } from "./anki-package.js";

const profile = (): AnkiImportProfile => ({
  schemaVersion: 1,
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
      outputs: [
        {
          id: "forward",
          name: "Language → translation",
          frontTemplate: "[[Lang]]",
          backTemplate:
            "| Sprache |[[Lang]] |\n| Übersetzung |[[Translation]] |",
          requiredNonEmptyFields: ["Lang", "Translation"],
          direction: "SOURCE_TO_TARGET",
          linkedToPrevious: false,
        },
        {
          id: "cloze",
          name: "Cloze",
          frontTemplate: "Übersetzung: {{[[Translation]]}}",
          backTemplate: "[[Lang]]",
          requiredNonEmptyFields: ["Translation"],
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
