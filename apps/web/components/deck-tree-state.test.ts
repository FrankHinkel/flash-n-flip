import { describe, expect, it } from "vitest";

import {
  learningSelectionDeckIds,
  toggleExpandedDeckPath,
  type DeckTreeNode,
} from "./deck-tree-state";

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

describe("deck learning selection", () => {
  it("updates only the clicked deck when its branch is closed", () => {
    expect([...learningSelectionDeckIds("a", new Set(), decks)]).toEqual(["a"]);
  });

  it("includes children and continues only through open child branches", () => {
    expect([...learningSelectionDeckIds("a", new Set(["a"]), decks)]).toEqual([
      "a",
      "a-one",
    ]);
    expect([
      ...learningSelectionDeckIds("a", new Set(["a", "a-one"]), decks),
    ]).toEqual(["a", "a-one", "a-leaf"]);
  });

  it("does not affect sibling branches", () => {
    expect([
      ...learningSelectionDeckIds("a", new Set(["a", "a-one", "b"]), decks),
    ]).toEqual(["a", "a-one", "a-leaf"]);
  });
});
