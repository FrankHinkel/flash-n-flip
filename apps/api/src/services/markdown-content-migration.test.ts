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

  it("migrates legacy GFM tables to wiki tables idempotently", () => {
    const markdown = {
      blocks: [
        {
          type: "markdown",
          revealMode: "ALL",
          source: [
            "## Konjugiere",
            "",
            "| Person | Form |",
            "| :--- | ---: |",
            "| ich | {{gehe|gehst}} |",
          ].join("\n"),
        },
      ],
    };
    const migrated = migrateUnknownCardContent(markdown) as typeof markdown;

    expect(migrated.blocks[0]?.source).toContain("^Person ^ Form^");
    expect(migrated.blocks[0]?.source).toContain("|ich | {{gehe|gehst}}|");
    expect(migrateUnknownCardContent(migrated)).toBe(migrated);
  });

  it("migrates generated conjugation paragraphs to one wiki table", () => {
    const markdown = {
      blocks: [
        {
          type: "markdown",
          revealMode: "SEQUENTIAL",
          source: [
            "## Konjugiere „gehen“",
            "",
            "### Singular",
            "",
            "(1) ich {{1:gehe|gehst}}",
            "",
            "(2) du {{2:gehst|gehe}}",
            "",
            "(3) er/sie/es {{3:geht|gehen}}",
            "",
            "### Plural",
            "",
            "(1) wir {{4:gehen|geht}}",
            "",
            "(2) ihr {{5:geht|gehen}}",
            "",
            "(3) sie/Sie {{6:gehen|geht}}",
          ].join("\n"),
        },
      ],
    };
    const migrated = migrateUnknownCardContent(markdown) as typeof markdown;

    expect(migrated.blocks[0]?.source).toContain("^ Singular · Präsens ^^");
    expect(migrated.blocks[0]?.source).toContain("^ Plural · Präsens ^^");
    expect(migrated.blocks[0]?.source).not.toContain("### Singular");
    expect(migrateUnknownCardContent(migrated)).toBe(migrated);
  });

  it("repairs duplicate explicit positions without touching code examples", () => {
    const markdown = {
      blocks: [
        {
          type: "markdown",
          revealMode: "SEQUENTIAL",
          source:
            "{{1:ich}}\n{{2:du}}\n{{1:er}}\n`{{1:inline}}`\n```\n{{1:fenced}}\n```",
        },
      ],
    };
    const repaired = migrateUnknownCardContent(markdown) as typeof markdown;
    expect(repaired.blocks[0]?.source).toBe(
      "{{1:ich}}\n{{2:du}}\n{{3:er}}\n`{{1:inline}}`\n```\n{{1:fenced}}\n```",
    );
    expect(migrateUnknownCardContent(repaired)).toBe(repaired);
  });
});
