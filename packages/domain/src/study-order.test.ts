import { describe, expect, it } from "vitest";

import { orderSequentialStudyScope } from "./study-order.js";

describe("orderSequentialStudyScope", () => {
  it("keeps collection decks contiguous in the requested hierarchy order", () => {
    const items = [
      { id: "a-2", deckId: "deck-a", position: 2 },
      { id: "b-2", deckId: "deck-b", position: 2 },
      { id: "a-1", deckId: "deck-a", position: 1 },
      { id: "b-1", deckId: "deck-b", position: 1 },
    ];

    expect(
      orderSequentialStudyScope(
        items,
        ["deck-b", "deck-a"],
        (item) => item,
      ).map(({ id }) => id),
    ).toEqual(["b-1", "b-2", "a-1", "a-2"]);
  });

  it("is deterministic for items outside the selected scope", () => {
    const items = [
      { id: "z", deckId: "deck-z", position: 1 },
      { id: "a", deckId: "deck-a", position: 1 },
    ];

    expect(orderSequentialStudyScope(items, [], (item) => item)).toEqual([
      items[1],
      items[0],
    ]);
  });
});
