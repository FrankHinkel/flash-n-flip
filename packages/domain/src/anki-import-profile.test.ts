import { describe, expect, it } from "vitest";

import {
  ankiImportProfileSchema,
  ankiProfileTemplateFields,
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
});
