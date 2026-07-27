import { describe, expect, it } from "vitest";

import {
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  visibleDeckIds,
} from "./deck-metrics";

describe("deck metrics", () => {
  it("collects a deck and all nested descendants for deletion", () => {
    const descendants = deckDescendantIds(
      [
        { id: "world", parentDeckId: null },
        { id: "europe", parentDeckId: "world" },
        { id: "germany", parentDeckId: "europe" },
        { id: "standalone", parentDeckId: null },
      ],
      "world",
    );

    expect([...descendants]).toEqual(["world", "europe", "germany"]);
    expect(deckDescendantIds([], "missing").size).toBe(0);
  });

  it("hides a deck and every descendant outside library management", () => {
    const visible = visibleDeckIds([
      { id: "world", parentDeckId: null, hiddenAt: new Date() },
      { id: "europe", parentDeckId: "world", hiddenAt: null },
      { id: "germany", parentDeckId: "europe", hiddenAt: null },
      { id: "standalone", parentDeckId: null, hiddenAt: null },
    ]);

    expect([...visible]).toEqual(["standalone"]);
  });

  it("derives progress from reviewed cards without exceeding bounds", () => {
    expect(deckProgressPercent(3, 4)).toBe(75);
    expect(deckProgressPercent(2, 0)).toBe(0);
    expect(deckProgressPercent(9, 4)).toBe(100);
  });

  it("formats compact localized byte sizes", () => {
    expect(formatByteSize(0, "en")).toBe("0 B");
    expect(formatByteSize(1536, "en")).toBe("1.5 KB");
    expect(formatByteSize(1536, "de")).toBe("1,5 KB");
  });
});
