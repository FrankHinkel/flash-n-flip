import { describe, expect, it } from "vitest";

import { toggleExpandedDeckPath, type DeckTreeNode } from "./deck-tree-state";

const decks: DeckTreeNode[] = [
  { id: "a", parentDeckId: null },
  { id: "a-one", parentDeckId: "a" },
  { id: "a-leaf", parentDeckId: "a-one" },
  { id: "b", parentDeckId: null },
  { id: "b-one", parentDeckId: "b" },
];

describe("deck tree expansion", () => {
  it("keeps exactly the ancestry path of the newly opened branch", () => {
    expect([
      ...toggleExpandedDeckPath(new Set(["a", "a-one"]), "b-one", decks),
    ]).toEqual(["b", "b-one"]);
  });

  it("collapses the selected branch and every expanded descendant", () => {
    expect([
      ...toggleExpandedDeckPath(
        new Set(["a", "a-one", "a-leaf"]),
        "a-one",
        decks,
      ),
    ]).toEqual(["a"]);
  });
});
