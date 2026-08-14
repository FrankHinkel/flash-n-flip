import { describe, expect, it } from "vitest";

import type { AnkiImportPreview } from "@flashcards/domain/anki-import-plan";
import type { AnkiProfileOutput } from "@flashcards/domain/anki-import-profile";

import {
  compileAnkiWikiLivePreview,
  createScopedAnkiWikiProfile,
} from "./anki-import-profile-editor";

describe("Anki Wiki profile editor", () => {
  it("uses the original Anki template and exposes its audio field", () => {
    const preview = {
      collectionTitle: "Languages",
      noteTypes: [
        {
          sourceNoteTypeId: "basic",
          name: "Basic",
          signature: "anki-note-v1-12345678",
          fields: [{ name: "Front" }, { name: "Back" }, { name: "Audio" }],
          templates: [
            {
              ord: 0,
              name: "Recognition",
              questionFields: ["Front"],
              answerFields: ["Back", "Audio"],
            },
          ],
        },
      ],
    } as AnkiImportPreview;

    const profile = createScopedAnkiWikiProfile(
      preview,
      {},
      {
        deckPath: ["Languages", "Icelandic"],
        card: {
          sourceId: "generated-card",
          sourceNoteId: "note",
          sourceNoteTypeId: "basic",
          sourceNoteTypeName: "Basic",
          sourceTemplateOrd: 4,
          sourceTemplateName: "Generated card",
          sourceOriginalTemplateOrd: 0,
          sourceOriginalTemplateName: "Recognition",
          front: { blocks: [{ type: "text", text: "Halló" }] },
          back: { blocks: [{ type: "text", text: "Hello" }] },
          tags: [],
        },
      },
    );

    expect(profile.rules[0]?.sourceTemplate).toEqual({
      ord: 0,
      name: "Recognition",
    });
    expect(profile.rules[0]?.outputs[0]?.frontTemplate).toBe("[[Front]]");
    expect(profile.rules[0]?.outputs[0]?.backTemplate).toBe(
      "[[Back]]\n\n[[Audio]]",
    );
  });

  it("recompiles the current record immediately from an edited Wiki draft", () => {
    const noteType = {
      sourceNoteTypeId: "basic",
      name: "Basic",
      signature: "anki-note-v1-12345678",
      fields: [
        { name: "Front", sample: "Halló" },
        { name: "Back", sample: "Hello" },
        { name: "Audio", sample: "" },
      ],
    } as AnkiImportPreview["noteTypes"][number];
    const card = {
      sourceId: "card",
      sourceNoteId: "note",
      sourceFields: {
        Front: { blocks: [{ type: "text" as const, text: "Halló" }] },
        Back: { blocks: [{ type: "text" as const, text: "Hello" }] },
        Audio: {
          blocks: [
            {
              type: "importAudio" as const,
              sourceName: "voice.mp3",
              label: "Imported audio",
            },
          ],
        },
      },
      sourceFieldText: { Front: "Halló", Back: "Hello", Audio: "" },
      front: { blocks: [{ type: "text" as const, text: "Halló" }] },
      back: { blocks: [{ type: "text" as const, text: "Hello" }] },
      tags: [],
    };
    const output: AnkiProfileOutput = {
      id: "card",
      name: "Card",
      frontTemplate: "[[Front]]",
      backTemplate: "[[Back]]",
      frontSections: [],
      backSections: [],
      requiredNonEmptyFields: [],
      direction: "SOURCE_TO_TARGET",
      linkedToPrevious: false,
      targetDeckPath: null,
    };

    const before = compileAnkiWikiLivePreview(output, noteType, card);
    const after = compileAnkiWikiLivePreview(
      { ...output, backTemplate: "Changed:\n\n[[AUDIO]]" },
      noteType,
      card,
    );

    expect(JSON.stringify(before.back)).toContain("Hello");
    expect(JSON.stringify(after.back)).toContain("Changed:");
    expect(after.back?.blocks.at(-1)).toEqual(
      expect.objectContaining({
        type: "importAudio",
        sourceName: "voice.mp3",
      }),
    );
  });
});
