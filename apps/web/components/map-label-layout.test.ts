import { describe, expect, it } from "vitest";

import {
  geographyMapIds,
  geographyMaps,
  geographyRegions,
  getGeographyMapPoint,
} from "@flashcards/domain";

import {
  layoutMapLabels,
  mapLabelRectsOverlap,
  mapShapeBounds,
} from "./map-label-layout";

const square = "M0 0L100 0L100 100L0 100Z";
const mapSize = { width: 200, height: 200 };

describe("map shape bounds", () => {
  it("derives the complete bounding box from multiple path rings", () => {
    expect(mapShapeBounds("M10 20L40 50ZM-5 15L12 70Z", [100, 100])).toEqual({
      left: -5,
      top: 15,
      right: 40,
      bottom: 70,
    });
  });

  it("uses a stable fallback around marker-only shapes", () => {
    expect(mapShapeBounds("M5 6a4 4 0 1 0 8 0Z", [5, 6])).toEqual({
      left: -13,
      top: -12,
      right: 23,
      bottom: 24,
    });
  });

  it("uses only the land part containing the capital", () => {
    expect(
      mapShapeBounds(
        "M20 20L80 20L80 80L20 80ZM170 150L190 150L190 180L170 180Z",
        [100, 100],
        [50, 50],
      ),
    ).toEqual({
      left: 20,
      top: 20,
      right: 80,
      bottom: 80,
    });
  });

  it("uses the nearest land part when simplified geometry misses the point", () => {
    expect(
      mapShapeBounds(
        "M20 20L80 20L80 80L20 80ZM170 150L190 150L190 180L170 180Z",
        [100, 100],
        [82, 50],
      ),
    ).toEqual({
      left: 20,
      top: 20,
      right: 80,
      bottom: 80,
    });
  });

  it("excludes Spain's remote islands from Madrid's label bounds", () => {
    const map = geographyMaps.europe;
    const region = geographyRegions.europe.find(({ code }) => code === "ES")!;
    const shape = map.shapes.ES!;
    const capitalPoint = getGeographyMapPoint(
      "europe",
      region.capitalMarkers[0]!.coordinates,
    );
    const fullBounds = mapShapeBounds(shape.path, shape.center);
    const capitalBounds = mapShapeBounds(
      shape.path,
      shape.center,
      capitalPoint,
    );
    const area = (bounds: typeof fullBounds) =>
      (bounds.right - bounds.left) * (bounds.bottom - bounds.top);

    expect(area(capitalBounds)).toBeLessThan(area(fullBounds));
    expect(capitalPoint[0]).toBeGreaterThanOrEqual(capitalBounds.left);
    expect(capitalPoint[0]).toBeLessThanOrEqual(capitalBounds.right);
    expect(capitalPoint[1]).toBeGreaterThanOrEqual(capitalBounds.top);
    expect(capitalPoint[1]).toBeLessThanOrEqual(capitalBounds.bottom);
  });
});

describe("capital label direction", () => {
  it.each([
    [[25, 75], "upper-right"],
    [[25, 25], "lower-right"],
    [[75, 25], "lower-left"],
    [[75, 75], "upper-left"],
  ] as const)(
    "places a capital at %j diagonally toward the country center",
    (point, direction) => {
      const result = layoutMapLabels({
        shapePath: square,
        fallbackCenter: [50, 50],
        mapSize,
        regionName: "Country",
        capitals: [{ point, name: "Capital" }],
      });

      expect(result.capitals[0]?.direction).toBe(direction);
    },
  );
});

describe("country and capital collision avoidance", () => {
  it("keeps the country name centered when the capital is far away", () => {
    const result = layoutMapLabels({
      shapePath: square,
      fallbackCenter: [50, 50],
      mapSize,
      regionName: "Country",
      capitals: [{ point: [10, 10], name: "Capital" }],
    });

    expect(result.region.x).toBe(50);
    expect(result.region.y).toBeCloseTo(54.2);
  });

  it("keeps the country name on the capital land part when capital labels are hidden", () => {
    const result = layoutMapLabels({
      shapePath: "M20 20L80 20L80 80L20 80ZM170 150L190 150L190 180L170 180Z",
      fallbackCenter: [100, 100],
      mapSize,
      regionName: "Country",
      focusPoint: [50, 50],
      capitals: [],
    });

    expect(result.shapeBounds).toEqual({
      left: 20,
      top: 20,
      right: 80,
      bottom: 80,
    });
    expect(result.region.x).toBe(50);
  });

  it("separates region names from every generated capital marker and label", () => {
    let checkedRegions = 0;
    for (const mapId of geographyMapIds) {
      const map = geographyMaps[mapId];
      const shapes = map.shapes as Record<
        string,
        { path: string; center: readonly [number, number] } | undefined
      >;
      for (const region of geographyRegions[mapId]) {
        const shape = shapes[region.code];
        if (!shape || !region.capitalMarkers.length) continue;
        const result = layoutMapLabels({
          shapePath: shape.path,
          fallbackCenter: shape.center,
          mapSize: map.viewBox,
          regionName: region.names.en,
          capitals: region.capitalMarkers.map((capital) => ({
            point: getGeographyMapPoint(mapId, capital.coordinates),
            name: capital.names.en,
          })),
        });
        checkedRegions += 1;
        for (const capital of result.capitals) {
          expect(
            mapLabelRectsOverlap(result.region.rect, capital.rect),
            `${mapId}/${region.code}: region label overlaps capital label`,
          ).toBe(false);
          expect(
            result.region.rect.left < capital.marker.x + 8.7 &&
              result.region.rect.right > capital.marker.x - 8.7 &&
              result.region.rect.top < capital.marker.y + 8.7 &&
              result.region.rect.bottom > capital.marker.y - 8.7,
            `${mapId}/${region.code}: region label overlaps capital marker`,
          ).toBe(false);
        }
        for (const [index, capital] of result.capitals.entries()) {
          for (const other of result.capitals.slice(index + 1)) {
            expect(
              mapLabelRectsOverlap(capital.rect, other.rect),
              `${mapId}/${region.code}: capital labels overlap`,
            ).toBe(false);
          }
        }
      }
    }
    expect(checkedRegions).toBeGreaterThan(150);
  });

  it("moves the country name only far enough to clear point and label", () => {
    const result = layoutMapLabels({
      shapePath: square,
      fallbackCenter: [50, 50],
      mapSize,
      regionName: "Long country name",
      capitals: [{ point: [43, 55], name: "Capital city" }],
    });
    const capital = result.capitals[0]!;

    expect(result.region.x === 50 && result.region.y === 54.2).toBe(false);
    expect(mapLabelRectsOverlap(result.region.rect, capital.rect)).toBe(false);
    expect(
      result.region.rect.left < capital.marker.x + 5.7 &&
        result.region.rect.right > capital.marker.x - 5.7 &&
        result.region.rect.top < capital.marker.y + 5.7 &&
        result.region.rect.bottom > capital.marker.y - 5.7,
    ).toBe(false);
  });

  it("uses another diagonal when two capital labels would collide", () => {
    const result = layoutMapLabels({
      shapePath: square,
      fallbackCenter: [50, 50],
      mapSize,
      regionName: "Country",
      capitals: [
        { point: [30, 70], name: "First capital" },
        { point: [31, 69], name: "Second capital" },
      ],
    });

    expect(result.capitals[0]?.direction).toBe("upper-right");
    expect(result.capitals[1]?.direction).not.toBe("upper-right");
    expect(
      mapLabelRectsOverlap(result.capitals[0]!.rect, result.capitals[1]!.rect),
    ).toBe(false);
  });
});
