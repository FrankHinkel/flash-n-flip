import { describe, expect, it } from "vitest";

import { prioritizeCloudDecks } from "./cloud-library-runtime";

describe("cloud transfer priority", () => {
  it("loads a learning branch first without placing a child before its parent", () => {
    const decks = [
      { id: "other", parent: null, learning: false },
      { id: "child", parent: "parent", learning: true },
      { id: "parent", parent: null, learning: false },
    ];
    expect(prioritizeCloudDecks(decks, (deck) => deck.learning, (deck) => deck.id, (deck) => deck.parent)
      .map((deck) => deck.id)).toEqual(["parent", "child", "other"]);
  });
});
