import { describe, expect, it } from "vitest";

import { createAnkiImportHierarchy } from "./anki-import-hierarchy.js";
import type { ParsedAnkiCard } from "./anki-package.js";

const card = (
  sourceCardId: string,
  sourceNoteId: string,
  unit?: string,
  topic?: string,
): ParsedAnkiCard => ({
  sourceCardId,
  sourceNoteId,
  sourceNoteTypeId: "100",
  sourceFields: {},
  sourceFieldText: { Einheit: unit ?? "", Thema: topic ?? "" },
  front: { blocks: [{ type: "text", text: sourceCardId }] },
  back: { blocks: [{ type: "text", text: sourceNoteId }] },
  tags: [],
});

describe("createAnkiImportHierarchy", () => {
  it("groups one file into a root collection and reuses shared lesson paths", () => {
    const result = createAnkiImportHierarchy("Anatomy and Physiology", [
      {
        sourceDeckId: "1",
        title: "Anatomy and Physiology › Unit 01 › Lesson 1",
        path: ["Anatomy and Physiology", "Unit 01", "Lesson 1"],
      },
      {
        sourceDeckId: "2",
        title: "Anatomy and Physiology › Unit 01 › Lesson 2",
        path: ["Anatomy and Physiology", "Unit 01", "Lesson 2"],
      },
      {
        sourceDeckId: "3",
        title: "Anatomy and Physiology › Unit 01",
        path: ["Anatomy and Physiology", "Unit 01"],
      },
    ]);

    expect(result.nodes.map((node) => node.title)).toEqual([
      "Anatomy and Physiology",
      "Unit 01",
      "Lesson 1",
      "Lesson 2",
    ]);
    expect(result.nodes[1]?.parentKey).toBe(result.collectionKey);
    expect(result.nodeKeyBySourceDeckId.get("3")).toBe(result.nodes[1]?.key);
    expect(result.nodeKeyBySourceDeckId.get("1")).toBe(result.nodes[2]?.key);
  });

  it("always creates a separate collection for a single flat Anki deck", () => {
    const result = createAnkiImportHierarchy("Vocabulary", [
      {
        sourceDeckId: "1",
        title: "Vocabulary",
        path: ["Vocabulary"],
      },
    ]);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({
      title: "Vocabulary",
      parentKey: null,
    });
    expect(result.nodes[1]).toMatchObject({
      title: "Cards",
      parentKey: result.collectionKey,
    });
  });

  it("creates ordered field subdecks and keeps cards without a value", () => {
    const first = card("card-1", "note-1", "E01", "Verben");
    const reverse = card("card-2", "note-1", "E01", "Verben");
    const missing = card("card-3", "note-2", undefined, "Nomen");
    const result = createAnkiImportHierarchy(
      "Spanisch 5000",
      [
        {
          sourceDeckId: "1",
          title: "Spanisch 5000",
          path: ["Spanisch 5000"],
          cards: [first, reverse, missing],
        },
      ],
      { "100": ["Einheit", "Thema"] },
    );

    expect(result.nodes.map((node) => node.title)).toEqual([
      "Spanisch 5000",
      "Cards",
      "E01",
      "Verben",
      "Ohne Einheit",
      "Nomen",
    ]);
    expect(result.generatedNodeCount).toBe(4);
    expect(result.nodeKeyByCard.get(first)).toBe(
      result.nodeKeyByCard.get(reverse),
    );
    expect(result.nodeKeyByCard.get(missing)).not.toBe(
      result.nodeKeyByCard.get(first),
    );
  });
});
