import { describe, expect, it } from "vitest";

import { geographyMaps, geographyRegions } from "@flashcards/domain";

import {
  createGeographyDeckSeed,
  geographyTemplates,
} from "./geography-decks.js";

describe("geography deck templates", () => {
  it("defines World as the parent of all six continent decks", () => {
    expect(
      geographyTemplates.filter((template) => template.parentId === "world"),
    ).toHaveLength(6);
    expect(
      geographyTemplates.find((template) => template.id === "world"),
    ).toMatchObject({ parentId: null, mapId: "world" });
  });

  it("creates an overview and one four-language card per map region", () => {
    for (const template of geographyTemplates) {
      const seed = createGeographyDeckSeed(template.id);
      const regions = geographyRegions[template.mapId];
      expect(seed.cards).toHaveLength(regions.length + 1);
      expect(seed.contentLocales).toEqual(["en", "de", "es", "fr"]);
      expect(
        regions.every(
          (region) =>
            (
              geographyMaps[template.mapId].shapes as Record<
                string,
                { path: string }
              >
            )[region.code]!.path.length > 0,
        ),
      ).toBe(true);
      for (const card of seed.cards) {
        expect(Object.keys(card.translations).sort()).toEqual([
          "de",
          "en",
          "es",
          "fr",
        ]);
      }
    }
  });

  it("keeps the highlighted region name off the question side", () => {
    for (const template of geographyTemplates) {
      const seed = createGeographyDeckSeed(template.id);
      for (const card of seed.cards.slice(1)) {
        for (const localized of Object.values(card.translations)) {
          const heading = localized.front.blocks.find(
            (block) => block.type === "heading",
          );
          const map = localized.front.blocks.find(
            (block) => block.type === "geographyMap",
          );
          expect(heading?.type).toBe("heading");
          expect(map?.type).toBe("geographyMap");
          if (heading?.type === "heading" && map?.type === "geographyMap") {
            expect(map.label).toBe(heading.text);
          }
        }
      }
    }
  });

  it("uses a national-language name instead of an English map placeholder", () => {
    const africa = createGeographyDeckSeed("africa");
    const algeria = africa.cards
      .slice(1)
      .find((card) =>
        Object.values(card.translations).some((localized) =>
          localized.back.blocks.some(
            (block) => block.type === "heading" && block.text === "Algeria",
          ),
        ),
      );
    const germanBackText = algeria?.translations.de?.back.blocks.find(
      (block) => block.type === "text",
    );
    expect(
      germanBackText?.type === "text" ? germanBackText.text : "",
    ).toContain("الجزائر");
  });
});
