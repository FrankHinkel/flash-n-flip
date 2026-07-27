import { describe, expect, it } from "vitest";

import { geographyMaps, geographyRegions } from "@flashcards/domain";

import {
  createGeographyDeckSeed,
  geographyTemplateKey,
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

  it("assigns every country to exactly one continent by greatest land area", () => {
    const continentMapIds = [
      "europe",
      "north-america",
      "south-america",
      "asia",
      "africa",
      "oceania",
    ] as const;
    const assignments = new Map<string, string>();
    for (const mapId of continentMapIds) {
      for (const region of geographyRegions[mapId]) {
        expect(assignments.has(region.code)).toBe(false);
        assignments.set(region.code, mapId);
      }
    }
    expect(assignments.get("RU")).toBe("asia");
    expect(assignments.get("TR")).toBe("asia");
    expect(
      geographyRegions.europe.some(
        (region) => (region.code as string) === "RU",
      ),
    ).toBe(false);
    expect(geographyTemplateKey("asia")).toBe("geography:asia:v2");
  });

  it("keeps Russia's Asia path free of projection-spanning line segments", () => {
    const path = geographyMaps.asia.shapes.RU!.path;
    const rings = [...path.matchAll(/M([^Z]+)Z/g)];
    const horizontalSegments = rings.flatMap((ring) => {
      const points = [
        ...ring[1]!.matchAll(/(?:^|L)(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g),
      ].map((point) => [Number(point[1]), Number(point[2])] as const);
      return points.slice(1).map((point, index) => ({
        width: Math.abs(point[0] - points[index]![0]),
        height: Math.abs(point[1] - points[index]![1]),
      }));
    });
    expect(
      horizontalSegments.some(
        (segment) =>
          segment.width > geographyMaps.asia.viewBox.width * 0.25 &&
          segment.height < 5,
      ),
    ).toBe(false);
  });

  it("places Vatican City next to Italy instead of at the map center", () => {
    const vatican = geographyMaps.europe.shapes.VA!.center;
    const italy = geographyMaps.europe.shapes.IT!.center;
    const germany = geographyMaps.europe.shapes.DE!.center;
    const distance = (
      left: readonly [number, number],
      right: readonly [number, number],
    ) => Math.hypot(left[0] - right[0], left[1] - right[1]);

    expect(distance(vatican, italy)).toBeLessThan(distance(vatican, germany));
    expect(distance(vatican, italy)).toBeLessThan(100);
  });

  it("adds only whole-continent context shapes around regional maps", () => {
    expect(Object.keys(geographyMaps.world.contextShapes)).toEqual([]);
    const ownContinent = {
      europe: "EU",
      "north-america": "NA",
      "south-america": "SA",
      asia: "AS",
      africa: "AF",
      oceania: "OC",
    } as const;
    for (const [mapId, ownCode] of Object.entries(ownContinent)) {
      const contextShapes =
        geographyMaps[mapId as keyof typeof ownContinent].contextShapes;
      expect(Object.keys(contextShapes)).toHaveLength(5);
      expect(ownCode in contextShapes).toBe(false);
      expect(
        Object.values(contextShapes).every((shape) => shape.path.length > 0),
      ).toBe(true);
    }
  });

  it("includes dated World Bank population and GDP values", () => {
    const russia = geographyRegions.asia.find((region) => region.code === "RU");
    expect(russia?.statistics?.population.value).toBeGreaterThan(100_000_000);
    expect(russia?.statistics?.population.year).toBeGreaterThanOrEqual(2024);
    expect(russia?.statistics?.gdpUsd.value).toBeGreaterThan(1_000_000_000_000);
    expect(russia?.statistics?.gdpUsd.year).toBeGreaterThanOrEqual(2024);
  });

  it("includes localized capitals for the country information controls", () => {
    const russia = geographyRegions.asia.find((region) => region.code === "RU");
    expect(russia?.capitals.en).toContain("Moscow");
    expect(russia?.capitals.de).toContain("Moskau");
    expect(russia?.capitals.es).toContain("Moscú");
    expect(russia?.capitals.fr).toContain("Moscou");
    for (const mapId of [
      "europe",
      "north-america",
      "south-america",
      "asia",
      "africa",
      "oceania",
    ] as const) {
      for (const region of geographyRegions[mapId]) {
        expect(region.capitals.en.length, `${region.code} en`).toBeGreaterThan(
          0,
        );
        expect(region.capitals.de.length, `${region.code} de`).toBeGreaterThan(
          0,
        );
        expect(region.capitals.es.length, `${region.code} es`).toBeGreaterThan(
          0,
        );
        expect(region.capitals.fr.length, `${region.code} fr`).toBeGreaterThan(
          0,
        );
      }
    }
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

  it("adds structured EU, NATO, and Schengen layers to Europe", () => {
    const europe = createGeographyDeckSeed("europe");
    const map = europe.cards[0]?.front.blocks.find(
      (block) => block.type === "geographyMap",
    );
    expect(map?.type).toBe("geographyMap");
    if (map?.type === "geographyMap") {
      expect(map.overlays.map((overlay) => overlay.id)).toEqual([
        "eu",
        "nato",
        "schengen",
      ]);
      expect(
        map.overlays.find((overlay) => overlay.id === "schengen")?.regionCodes,
      ).toContain("RO");
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
