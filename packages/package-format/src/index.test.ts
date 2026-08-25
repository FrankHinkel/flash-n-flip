import { describe, expect, it } from "vitest";

import {
  fnfV3CardSchema,
  fnfV3ManifestSchema,
  parseFnfV3JsonLines,
  stringifyFnfV3JsonLines,
  validateFnfV3ContentReferences,
} from "./index.js";

const deckId = "00000000-0000-4000-8000-000000000001";
const noteId = "00000000-0000-4000-8000-000000000002";
const cardId = "00000000-0000-4000-8000-000000000003";

describe("FNF v3 package contract", () => {
  it("round-trips JSONL records with supplemental content and complete tags", () => {
    const card = fnfV3CardSchema.parse({
      schemaVersion: 1,
      id: cardId,
      deckId,
      noteId,
      position: 0,
      front: { blocks: [{ type: "text", text: "Question" }] },
      back: { blocks: [{ type: "text", text: "Answer" }] },
      supplementalContent: [
        {
          label: "Example",
          content: { blocks: [{ type: "text", text: "Extra" }] },
        },
      ],
      tags: Array.from({ length: 40 }, (_, index) => `tag-${index}`),
      linkedToPrevious: false,
      translations: {},
      kind: "QUESTION",
      suspended: false,
    });

    expect(
      parseFnfV3JsonLines(
        stringifyFnfV3JsonLines([card]),
        fnfV3CardSchema,
        "cards",
      ),
    ).toEqual([card]);
  });

  it("preserves reference usage and defaults older cards to learning", () => {
    const base = {
      schemaVersion: 1 as const,
      id: cardId,
      deckId,
      noteId,
      position: 0,
      front: { blocks: [{ type: "text" as const, text: "" }] },
      back: { blocks: [{ type: "text" as const, text: "Reference" }] },
      supplementalContent: [],
      tags: [],
      linkedToPrevious: false,
      translations: {},
      kind: "QUESTION" as const,
      suspended: false,
    };

    expect(fnfV3CardSchema.parse(base).usage).toBe("LEARNING");
    expect(fnfV3CardSchema.parse({ ...base, usage: "REFERENCE" }).usage).toBe(
      "REFERENCE",
    );
  });

  it("rejects progress entries in content-only manifests", () => {
    expect(() =>
      fnfV3ManifestSchema.parse({
        format: "flash-n-flip.package",
        formatVersion: 3,
        packageId: cardId,
        lineageId: noteId,
        createdAt: "2026-08-19T18:00:00.000Z",
        generator: { name: "Test", version: "1" },
        profile: "CONTENT_ONLY",
        requiredFeatures: ["core-content-v1"],
        optionalFeatures: [],
        roots: [deckId],
        entries: [
          "content/decks.jsonl",
          "content/notes.jsonl",
          "content/cards.jsonl",
          "content/media.jsonl",
          "progress/reviews.jsonl",
        ].map((path) => ({
          path,
          mediaType: "application/jsonl",
          byteSize: 1,
          sha256: "0".repeat(64),
        })),
      }),
    ).toThrow();
  });

  it("rejects cyclic deck hierarchies", () => {
    const secondDeckId = "00000000-0000-4000-8000-000000000004";
    expect(() =>
      validateFnfV3ContentReferences({
        manifest: {
          format: "flash-n-flip.package",
          formatVersion: 3,
          packageId: cardId,
          lineageId: noteId,
          createdAt: "2026-08-19T18:00:00.000Z",
          generator: { name: "Test", version: "1" },
          profile: "CONTENT_ONLY",
          requiredFeatures: ["core-content-v1"],
          optionalFeatures: [],
          roots: [deckId],
          entries: [],
        },
        decks: [
          {
            schemaVersion: 1,
            id: deckId,
            parentId: secondDeckId,
            title: "First",
            description: "",
            language: "de",
            contentLocales: ["de"],
            defaultContentLocale: "de",
            sourceLocale: "de",
            targetLocale: "de",
            languageDirectionMode: "OVERRIDE",
            sourceLocaleOverride: null,
            targetLocaleOverride: null,
            studyOrder: "SCHEDULED",
            tags: [],
            visual: null,
            sourceTemplateKey: null,
            contentStyles: [],
          },
          {
            schemaVersion: 1,
            id: secondDeckId,
            parentId: deckId,
            title: "Second",
            description: "",
            language: "de",
            contentLocales: ["de"],
            defaultContentLocale: "de",
            sourceLocale: "de",
            targetLocale: "de",
            languageDirectionMode: "INHERIT",
            sourceLocaleOverride: null,
            targetLocaleOverride: null,
            studyOrder: "SCHEDULED",
            tags: [],
            visual: null,
            sourceTemplateKey: null,
            contentStyles: [],
          },
        ],
        notes: [],
        cards: [],
        media: [],
      }),
    ).toThrow(/cyclic/i);
  });
});
