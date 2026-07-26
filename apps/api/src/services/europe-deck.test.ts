import { describe, expect, it } from "vitest";

import { europeCountries, europeMapShapes } from "@flashcards/domain";

import { createEuropeDeckSeed } from "./europe-deck.js";

describe("Europe deck template", () => {
  it("creates an overview and one four-language card for every country", () => {
    const seed = createEuropeDeckSeed();
    expect(europeCountries).toHaveLength(51);
    expect(Object.keys(europeMapShapes)).toHaveLength(51);
    expect(
      europeCountries.every(
        (country) =>
          europeMapShapes[country.code as keyof typeof europeMapShapes].path
            .length > 0,
      ),
    ).toBe(true);
    expect(seed.cards).toHaveLength(52);
    expect(seed.contentLocales).toEqual(["en", "de", "es", "fr"]);
    for (const card of seed.cards) {
      expect(Object.keys(card.translations).sort()).toEqual([
        "de",
        "en",
        "es",
        "fr",
      ]);
    }
  });

  it("links every map region to its stable country card", () => {
    const seed = createEuropeDeckSeed();
    const overview = seed.cards[0]!.front.blocks.find(
      (block) => block.type === "europeMap",
    );
    expect(overview?.type).toBe("europeMap");
    if (overview?.type !== "europeMap") return;
    expect(overview.interactive).toBe(true);
    expect(overview.targets).toHaveLength(51);
    expect(new Set(overview.targets.map((target) => target.cardId)).size).toBe(
      51,
    );
  });
});
