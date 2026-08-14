import { describe, expect, it } from "vitest";

import {
  applyCustomAnkiImportProfile,
  compileAnkiProfileOutput,
  compileAnkiProfileSide,
  compileAnkiProfileTemplate,
  type AnkiProfileFieldValue,
} from "./anki-import-apply-profile.js";
import {
  ankiNoteTypeSignature,
  type AnkiImportProfile,
  type AnkiProfileOutput,
} from "./anki-import-profile.js";
import type { ParsedAnkiPackage } from "./anki-import-types.js";

const fields = new Map<string, AnkiProfileFieldValue>([
  [
    "Front",
    {
      text: "Safe question",
      content: { blocks: [{ type: "text", text: "Safe question" }] },
    },
  ],
  [
    "Audio",
    {
      text: "",
      content: {
        blocks: [
          {
            type: "importAudio",
            sourceName: "answer-name.mp3",
            label: "Answer name",
          },
        ],
      },
    },
  ],
]);

const output: AnkiProfileOutput = {
  id: "card",
  name: "Card",
  frontTemplate: "Listen: [[audio]]",
  backTemplate: "[[Front]]",
  frontSections: [],
  backSections: [],
  requiredNonEmptyFields: [],
  direction: "SOURCE_TO_TARGET",
  linkedToPrevious: false,
  targetDeckPath: null,
};

describe("Anki profile template compilation", () => {
  it("resolves textual field names case-insensitively", () => {
    const compiled = compileAnkiProfileTemplate(
      "Question: [[front]]",
      new Map([["Front", "Safe question"]]),
    );

    expect(JSON.stringify(compiled)).toContain("Safe question");
  });

  it("supports field names with spaces", () => {
    const compiled = compileAnkiProfileTemplate(
      "[[Subject Clozes]]",
      new Map([["Subject Clozes", "1, 2"]]),
    );

    expect(JSON.stringify(compiled)).toContain("1, 2");
  });

  it("keeps blank fields out of rich-text text nodes", () => {
    const compiled = compileAnkiProfileTemplate(
      "[[Subject Clozes]]\n\n| Subject | [[Subject Clozes]] |",
      new Map([["Subject Clozes", "   "]]),
    );

    expect(JSON.stringify(compiled)).not.toContain('"text":""');
  });

  it("applies named styles to text fields without reparsing their values", () => {
    const compiled = compileAnkiProfileTemplate(
      "Before [[Front]]{accent} after [[Front]]{hint}}",
      new Map([["Front", "**literal**"]]),
    );
    const serialized = JSON.stringify(compiled);

    expect(serialized).toContain('"type":"contentStyle"');
    expect(serialized).toContain('"name":"accent"');
    expect(serialized).toContain('"name":"hint"');
    expect(serialized).toContain('"text":"**literal**"');
    expect(serialized).not.toContain('"type":"bold"');
  });

  it("rejects named styles on structured media fields", () => {
    expect(() => compileAnkiProfileSide("[[Audio]]{accent}", fields)).toThrow(
      /nicht auf Medienfelder/i,
    );
  });

  it("inserts an inline audio field as sanitized structured content", () => {
    const compiled = compileAnkiProfileSide("Listen: [[audio]]", fields);

    expect(compiled.blocks).toHaveLength(2);
    expect(compiled.blocks[1]).toEqual({
      type: "importAudio",
      sourceName: "answer-name.mp3",
      label: "Answer name",
    });
  });

  it("uses the same structured compiler for editable output previews", () => {
    const compiled = compileAnkiProfileOutput(output, fields);

    expect(compiled.front.blocks.at(-1)?.type).toBe("importAudio");
    expect(JSON.stringify(compiled.back)).toContain("Safe question");
  });

  it("does not reparse imported field values as executable Wiki source", () => {
    const hostileFields = new Map<string, AnkiProfileFieldValue>([
      [
        "Front",
        {
          text: "<script>alert(1)</script> [[Audio]]",
          content: {
            blocks: [
              {
                type: "text",
                text: "<script>alert(1)</script> [[Audio]]",
              },
            ],
          },
        },
      ],
    ]);

    const compiled = compileAnkiProfileSide("[[Front]]", hostileFields);
    expect(JSON.stringify(compiled)).toContain("<script>alert(1)</script>");
    expect(JSON.stringify(compiled)).not.toContain('type":"audio"');
  });

  it("keeps source signatures stable while adding generated profile templates", () => {
    const noteType = {
      sourceNoteTypeId: "basic",
      name: "Basic",
      isCloze: false,
      fields: ["Front", "Audio"],
      templates: [
        {
          ord: 0,
          name: "Card 1",
          questionFields: ["Front"],
          answerFields: ["Audio"],
        },
      ],
    };
    const parsed: ParsedAnkiPackage = {
      collectionTitle: "Audio",
      decks: [
        {
          sourceDeckId: "deck",
          title: "Audio",
          path: ["Audio"],
          cards: [
            {
              sourceNoteId: "note",
              sourceNoteTypeId: "basic",
              sourceNoteTypeName: "Basic",
              sourceTemplateOrd: 0,
              sourceTemplateName: "Card 1",
              sourceFields: Object.fromEntries(
                [...fields].map(([name, value]) => [name, value.content]),
              ),
              sourceFieldText: Object.fromEntries(
                [...fields].map(([name, value]) => [name, value.text]),
              ),
              front: fields.get("Front")!.content,
              back: fields.get("Audio")!.content,
              tags: [],
            },
          ],
        },
      ],
      media: [],
      warnings: [],
      packageVersion: "legacy",
      noteTypes: [noteType],
    };
    const profile: AnkiImportProfile = {
      schemaVersion: 2,
      id: "019ffb67-ff04-7591-a849-a234c0ff9c7d",
      name: "Audio profile",
      description: "",
      createdAt: "2026-08-14T08:00:00.000Z",
      updatedAt: "2026-08-14T08:00:00.000Z",
      rules: [
        {
          id: "basic-audio",
          noteTypeName: "Basic",
          requiredFields: ["Front", "Audio"],
          noteTypeSignature: ankiNoteTypeSignature(noteType),
          sourceDeckPath: null,
          sourceTemplate: { ord: 0 },
          outputs: [output],
        },
      ],
    };

    const result = applyCustomAnkiImportProfile(parsed, profile, {
      sourceLocale: "en",
      targetLocale: "de",
    });

    expect(result.decks[0]?.cards[0]?.front.blocks.at(-1)?.type).toBe(
      "importAudio",
    );
    expect(result.noteTypes[0]?.templates).toHaveLength(2);
  });
});
