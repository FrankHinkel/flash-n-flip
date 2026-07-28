import { describe, expect, it } from "vitest";

import { createAnkiImportHierarchy } from "./anki-import-hierarchy.js";

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
});
