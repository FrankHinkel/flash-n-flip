import { describe, expect, it } from "vitest";

import {
  migrateCardTranslations,
  migrateNoteFields,
  migrateUnknownCardContent,
} from "./markdown-content-migration.js";

const legacy = {
  blocks: [
    {
      type: "richText",
      revealMode: "SEQUENTIAL",
      document: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Frage" }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Wir " },
              {
                type: "cloze",
                attrs: {
                  id: "gap-1",
                  order: 1,
                  answer: "gehen",
                  choices: ["gehen", "geht"],
                  hint: null,
                },
              },
            ],
          },
        ],
      },
    },
  ],
};

describe("Markdown content migration", () => {
  it("converts legacy rich text without changing surrounding blocks", () => {
    expect(migrateUnknownCardContent(legacy)).toEqual({
      blocks: [
        {
          type: "markdown",
          revealMode: "SEQUENTIAL",
          source: "## Frage\n\nWir {{1:gehen|geht}}",
        },
      ],
    });
  });

  it("migrates notes and translations idempotently", () => {
    const fields = {
      front: legacy,
      back: { blocks: [{ type: "text", text: "Antwort" }] },
      translations: { de: { front: legacy, back: legacy } },
      custom: "kept",
    };
    const once = migrateNoteFields(fields);
    const twice = migrateNoteFields(once);
    expect(twice).toEqual(once);
    expect(
      migrateCardTranslations({ de: { front: legacy, back: legacy } }),
    ).toEqual((once as Record<string, unknown>).translations);
  });

  it("does not normalize content that is already Markdown", () => {
    const markdown = {
      blocks: [
        {
          type: "markdown",
          revealMode: "ALL",
          source: "Already migrated.",
        },
        {
          type: "geographyMap",
          mapId: "europe",
          label: "Map without serialized schema defaults",
        },
      ],
    };
    expect(migrateUnknownCardContent(markdown)).toBe(markdown);
  });
});
