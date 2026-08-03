import { describe, expect, it } from "vitest";

import type { AnkiImportPreview } from "@flashcards/api-client";

import {
  ankiFieldRoleControlName,
  submittedAnkiFieldMappings,
} from "./anki-field-mapping";

const field = (
  name: string,
  suggestedRole: AnkiImportPreview["noteTypes"][number]["fields"][number]["suggestedRole"],
) => ({
  name,
  sample: "",
  sampleValues: [],
  distinctValueCount: 0,
  mediaKinds: [],
  mediaCount: 0,
  suggestedRole,
});

const preview = {
  noteTypes: [
    {
      sourceNoteTypeId: "100",
      name: "Basic",
      isCloze: false,
      cardCount: 1,
      fields: [
        field("Front", "PRIMARY_A"),
        field("Back", "PRIMARY_B"),
        field("Comment", "HINT"),
      ],
      templates: [],
    },
    {
      sourceNoteTypeId: "200",
      name: "Lückentext",
      isCloze: true,
      cardCount: 1,
      fields: [field("Text", "PRIMARY_A")],
      templates: [],
    },
  ],
} satisfies Pick<AnkiImportPreview, "noteTypes">;

describe("submitted Anki field mappings", () => {
  it("uses the values visible in the submitted form", () => {
    const data = new FormData();
    data.set(ankiFieldRoleControlName("100", "Front"), "IGNORE");
    data.set(ankiFieldRoleControlName("100", "Back"), "PRIMARY_A");
    data.set(ankiFieldRoleControlName("100", "Comment"), "PRIMARY_B");

    expect(submittedAnkiFieldMappings(preview, data)).toEqual({
      "100": {
        Front: "IGNORE",
        Back: "PRIMARY_A",
        Comment: "PRIMARY_B",
      },
    });
  });

  it("rejects a missing visible assignment instead of using a stale default", () => {
    const data = new FormData();
    data.set(ankiFieldRoleControlName("100", "Front"), "PRIMARY_A");
    data.set(ankiFieldRoleControlName("100", "Back"), "PRIMARY_B");

    expect(() => submittedAnkiFieldMappings(preview, data)).toThrow(
      /Comment.*incomplete/,
    );
  });
});
