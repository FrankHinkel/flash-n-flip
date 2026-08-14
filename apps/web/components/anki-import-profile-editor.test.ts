import { describe, expect, it } from "vitest";

import type { AnkiImportPreview } from "@flashcards/domain/anki-import-plan";

import { createScopedAnkiWikiProfile } from "./anki-import-profile-editor";

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
});
