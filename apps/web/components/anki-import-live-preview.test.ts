import { describe, expect, it } from "vitest";

import type { LocalImportCard } from "../lib/local-file-import";
import {
  ankiImportLivePreviewRecords,
  ankiImportPreviewContentWithoutMedia,
  ankiImportPreviewMediaReferences,
  clampedAnkiImportPreviewRecordIndex,
  toggledAnkiImportPreviewDeck,
} from "./anki-import-live-preview";

const card = (note: number, template = 0): LocalImportCard => ({
  sourceId: `card-${note}-${template}`,
  sourceNoteId: `note-${note}`,
  sourceNoteTypeName: "Basic",
  sourceTemplateName: `Card ${template + 1}`,
  sourceFieldText: { Front: `Question ${note}`, Back: `Answer ${note}` },
  front: { blocks: [{ type: "text", text: `Question ${note}` }] },
  back: { blocks: [{ type: "text", text: `Answer ${note}` }] },
  tags: template ? ["second"] : ["first"],
});

describe("Anki import live preview", () => {
  it("allows exactly one open deck and closes the current deck on repetition", () => {
    expect(toggledAnkiImportPreviewDeck(null, "deck-a")).toBe("deck-a");
    expect(toggledAnkiImportPreviewDeck("deck-a", "deck-b")).toBe("deck-b");
    expect(toggledAnkiImportPreviewDeck("deck-b", "deck-b")).toBeNull();
  });

  it("groups every generated card of one Anki note into one record", () => {
    const records = ankiImportLivePreviewRecords({
      cards: [card(1, 0), card(1, 1), card(2, 0)],
    });

    expect(records).toHaveLength(2);
    expect(records[0]?.cards).toHaveLength(2);
    expect(records[0]?.tags).toEqual(["first", "second"]);
    expect(records[1]?.sourceNoteId).toBe("note-2");
  });

  it("does not impose a sample or page limit on preview records", () => {
    const records = ankiImportLivePreviewRecords({
      cards: Array.from({ length: 2_501 }, (_, index) => card(index + 1)),
    });

    expect(records).toHaveLength(2_501);
    expect(records.at(-1)?.sourceFieldText.Front).toBe("Question 2501");
  });

  it("keeps navigation inside the complete finite deck", () => {
    expect(clampedAnkiImportPreviewRecordIndex(-5, 20)).toBe(0);
    expect(clampedAnkiImportPreviewRecordIndex(12.8, 20)).toBe(12);
    expect(clampedAnkiImportPreviewRecordIndex(99, 20)).toBe(19);
    expect(clampedAnkiImportPreviewRecordIndex(Number.NaN, 20)).toBe(0);
  });

  it("extracts only local media references needed by the current side", () => {
    expect(
      ankiImportPreviewMediaReferences({
        blocks: [
          { type: "text", text: "Question" },
          {
            type: "importImage",
            sourceName: "flag.gif",
            alt: "State flag",
            decorative: false,
          },
          {
            type: "importAudio",
            sourceName: "name.mp3",
            label: "Pronunciation",
          },
        ],
      }),
    ).toEqual([
      {
        kind: "image",
        sourceName: "flag.gif",
        label: "State flag",
        decorative: false,
      },
      {
        kind: "audio",
        sourceName: "name.mp3",
        label: "Pronunciation",
      },
    ]);
  });

  it("never exposes answer-bearing media names in visible preview content", () => {
    const visibleContent = ankiImportPreviewContentWithoutMedia({
      blocks: [
        {
          type: "importImage",
          sourceName: "Afghanistan_is_the_answer.png",
          alt: "Afghanistan is the answer",
          decorative: false,
        },
        { type: "text", text: "Which country is highlighted?" },
        {
          type: "importAudio",
          sourceName: "answer-Afghanistan.mp3",
          label: "Afghanistan",
        },
      ],
    });

    expect(visibleContent).toEqual({
      blocks: [{ type: "text", text: "Which country is highlighted?" }],
    });
    expect(JSON.stringify(visibleContent)).not.toContain("Afghanistan");
  });

  it("keeps a valid empty display block when a card side only contains media", () => {
    expect(
      ankiImportPreviewContentWithoutMedia({
        blocks: [
          {
            type: "image",
            sourceName: "answer.png",
            alt: "Answer",
            decorative: false,
          },
        ],
      }),
    ).toEqual({
      blocks: [{ type: "markdown", revealMode: "ALL", source: "" }],
    });
  });
});
