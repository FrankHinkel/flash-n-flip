import { describe, expect, it } from "vitest";

import {
  createAnkiSourceHierarchyPreview,
  sortAnkiDecksHierarchically,
} from "./anki-import-hierarchy.js";

const decks = [
  {
    sourceDeckId: "science",
    title: "10 Science",
    path: ["Collection", "10 Science"],
    cards: [],
  },
  {
    sourceDeckId: "geo-10",
    title: "10 Capitals",
    path: ["Collection", "02 Geography", "10 Capitals"],
    cards: [],
  },
  {
    sourceDeckId: "geo",
    title: "02 Geography",
    path: ["Collection", "02 Geography"],
    cards: [],
  },
  {
    sourceDeckId: "basics",
    title: "01 Basics",
    path: ["Collection", "01 Basics"],
    cards: [],
  },
  {
    sourceDeckId: "geo-2",
    title: "2 Countries",
    path: ["Collection", "02 Geography", "2 Countries"],
    cards: [],
  },
];

describe("Anki deck hierarchy", () => {
  it("sorts naturally at each hierarchy level and keeps parents first", () => {
    expect(
      sortAnkiDecksHierarchically(decks).map((deck) => deck.sourceDeckId),
    ).toEqual(["basics", "geo", "geo-2", "geo-10", "science"]);
  });

  it("uses the same hierarchy order in the import preview", () => {
    const preview = createAnkiSourceHierarchyPreview("Collection", decks);

    expect(preview.decks.map((deck) => deck.path)).toEqual([
      ["01 Basics"],
      ["02 Geography"],
      ["02 Geography", "2 Countries"],
      ["02 Geography", "10 Capitals"],
      ["10 Science"],
    ]);
  });
});
