import { describe, expect, it } from "vitest";

import {
  buildMyICloudDeckTree,
  flattenVisibleMyICloudDeckTree,
} from "./my-icloud-deck-tree";

describe("My iCloud deck hierarchy", () => {
  it("keeps parents above children without changing sibling order", () => {
    const tree = buildMyICloudDeckTree([
      { id: "child-b", parentDeckId: "root" },
      { id: "root", parentDeckId: null },
      { id: "child-a", parentDeckId: "root" },
      { id: "second-root", parentDeckId: null },
    ]);

    expect(tree.roots.map((node) => node.deck.id)).toEqual([
      "root",
      "second-root",
    ]);
    expect(tree.roots[0]?.children.map((node) => node.deck.id)).toEqual([
      "child-b",
      "child-a",
    ]);
    expect(tree.withheldCount).toBe(0);
  });

  it("does not promote orphaned or cyclic decks to the top level", () => {
    const tree = buildMyICloudDeckTree([
      { id: "valid", parentDeckId: null },
      { id: "orphan", parentDeckId: "missing" },
      { id: "orphan-child", parentDeckId: "orphan" },
      { id: "cycle-a", parentDeckId: "cycle-b" },
      { id: "cycle-b", parentDeckId: "cycle-a" },
    ]);

    expect(tree.roots.map((node) => node.deck.id)).toEqual(["valid"]);
    expect(tree.withheldCount).toBe(4);
  });

  it("reveals only descendants of expanded decks", () => {
    const tree = buildMyICloudDeckTree([
      { id: "root", parentDeckId: null },
      { id: "child", parentDeckId: "root" },
      { id: "grandchild", parentDeckId: "child" },
    ]);

    expect(
      flattenVisibleMyICloudDeckTree(tree.roots, new Set()).map(
        ({ deck, depth }) => [deck.id, depth],
      ),
    ).toEqual([["root", 0]]);
    expect(
      flattenVisibleMyICloudDeckTree(
        tree.roots,
        new Set(["root", "child"]),
      ).map(({ deck, depth }) => [deck.id, depth]),
    ).toEqual([
      ["root", 0],
      ["child", 1],
      ["grandchild", 2],
    ]);
  });
});
