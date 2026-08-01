import { describe, expect, it } from "vitest";

import { createMobileStudyFixture } from "./study-fixtures";

describe("createMobileStudyFixture", () => {
  it("provides a multilingual text card for the native layout preview", () => {
    const fixture = createMobileStudyFixture("text");
    expect(fixture.deck.contentLocales).toEqual(["en", "de"]);
    expect(fixture.cards).toHaveLength(1);
  });

  it("provides both map run and explore states", () => {
    const fixture = createMobileStudyFixture("map");
    expect(fixture.deck.cards).toHaveLength(2);
    expect(
      fixture.deck.cards.some((entry) =>
        entry.front.blocks.some(
          (block) => block.type === "geographyMap" && block.interactive,
        ),
      ),
    ).toBe(true);
  });
});
