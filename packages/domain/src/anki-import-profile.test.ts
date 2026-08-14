import { describe, expect, it } from "vitest";

import {
  ankiImportProfileSchema,
  ankiNoteTypeSignature,
  ankiProfileTemplateFields,
  ankiSourceDeckPathMatches,
  hasMalformedAnkiProfilePlaceholder,
} from "./anki-import-profile.js";

describe("Anki import profile contract", () => {
  it("extracts reusable field placeholders", () => {
    expect(
      ankiProfileTemplateFields(
        "| Sprache |[[Lang]] |\n| Übersetzung |[[Translation]] |\n[[Lang]]",
      ),
    ).toEqual(["Lang", "Translation"]);
  });

  it("extracts field names independently of their optional named style", () => {
    expect(
      ankiProfileTemplateFields("[[Subject Clozes]]{hint} [[Answer]]{accent}}"),
    ).toEqual(["Subject Clozes", "Answer"]);
  });

  it("rejects duplicate output identifiers", () => {
    const output = {
      id: "card",
      name: "Card",
      frontTemplate: "[[Front]]",
      backTemplate: "[[Back]]",
      requiredNonEmptyFields: [],
      direction: "SOURCE_TO_TARGET" as const,
      linkedToPrevious: false,
    };
    expect(
      ankiImportProfileSchema.safeParse({
        schemaVersion: 1,
        id: "2c50b4d9-69b2-4d30-9f39-e0263d9922f1",
        name: "Profile",
        description: "",
        createdAt: "2026-08-08T10:00:00.000Z",
        updatedAt: "2026-08-08T10:00:00.000Z",
        rules: [
          {
            id: "rule",
            noteTypeName: "Basic",
            requiredFields: ["Front", "Back"],
            outputs: [output, output],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("detects unfinished placeholders", () => {
    expect(hasMalformedAnkiProfilePlaceholder("[[Front")).toBe(true);
    expect(hasMalformedAnkiProfilePlaceholder("[[Front]]")).toBe(false);
  });

  it("migrates saved V1 profiles without changing their output semantics", () => {
    const migrated = ankiImportProfileSchema.parse({
      schemaVersion: 1,
      id: "2c50b4d9-69b2-4d30-9f39-e0263d9922f1",
      name: "Profile",
      description: "",
      createdAt: "2026-08-08T10:00:00.000Z",
      updatedAt: "2026-08-08T10:00:00.000Z",
      rules: [
        {
          id: "rule",
          noteTypeName: "Basic",
          requiredFields: ["Front", "Back"],
          outputs: [
            {
              id: "card",
              name: "Card",
              frontTemplate: "[[Front]]",
              backTemplate: "[[Back]]",
              requiredNonEmptyFields: [],
              direction: "SOURCE_TO_TARGET",
              linkedToPrevious: false,
            },
          ],
        },
      ],
    });

    expect(migrated).toMatchObject({
      schemaVersion: 2,
      rules: [
        {
          noteTypeSignature: null,
          sourceDeckPath: null,
          sourceTemplate: null,
          outputs: [
            { frontSections: [], backSections: [], targetDeckPath: null },
          ],
        },
      ],
    });
  });

  it("creates a stable structural signature and matches bounded deck globs", () => {
    const first = ankiNoteTypeSignature({
      name: " Basic ",
      fields: ["Back", "Front"],
      templates: [
        {
          ord: 0,
          name: "Card 1",
          questionFields: ["Front"],
          answerFields: ["Back"],
        },
      ],
    });
    const reordered = ankiNoteTypeSignature({
      name: "basic",
      fields: ["Front", "Back"],
      templates: [
        {
          ord: 0,
          name: "card 1",
          questionFields: ["Front"],
          answerFields: ["Back"],
        },
      ],
    });

    expect(first).toBe(reordered);
    expect(first).toMatch(/^anki-note-v1-[a-f0-9]{8}$/);
    expect(
      ankiSourceDeckPathMatches("Allgemeinwissen/**", [
        "Allgemeinwissen",
        "Deutschland",
        "Bundesländer",
      ]),
    ).toBe(true);
    expect(
      ankiSourceDeckPathMatches("Allgemeinwissen/*", [
        "Allgemeinwissen",
        "Deutschland",
        "Bundesländer",
      ]),
    ).toBe(false);
  });
});
