import { describe, expect, it } from "vitest";

import {
  isMapDrag,
  mapInfoSideWithHysteresis,
  nearestMapTouchRegion,
  oppositeMapInfoSide,
  sortMapRegions,
  wheelZoomFactor,
} from "./map-interaction";

describe("map drag detection", () => {
  it("keeps a stationary pointer eligible for the card click", () => {
    expect(isMapDrag(100, 100, 103, 102)).toBe(false);
    expect(isMapDrag(100, 100, 107, 106)).toBe(false);
  });

  it("suppresses the card click after panning beyond the threshold", () => {
    expect(isMapDrag(100, 100, 111, 100)).toBe(true);
    expect(isMapDrag(100, 100, 92, 93)).toBe(true);
  });
});

describe("small map-region touch targets", () => {
  const map = {
    bounds: { left: 10, top: 20, width: 450, height: 230 },
    viewBox: { width: 900, height: 460 },
    zoom: 1,
    offset: { x: 0, y: 0 },
  };

  it("provides a 56 CSS-pixel target around a tiny region", () => {
    expect(
      nearestMapTouchRegion({
        ...map,
        pointer: { x: 222, y: 135 },
        regions: [{ code: "VA", center: [400, 230] }],
      }),
    ).toBe("VA");
  });

  it("selects the nearest tiny region when touch targets overlap", () => {
    expect(
      nearestMapTouchRegion({
        ...map,
        pointer: { x: 214, y: 135 },
        regions: [
          { code: "VA", center: [400, 230] },
          { code: "SM", center: [430, 230] },
        ],
      }),
    ).toBe("VA");
  });

  it("does not steal taps outside the small-region target", () => {
    expect(
      nearestMapTouchRegion({
        ...map,
        pointer: { x: 280, y: 135 },
        regions: [{ code: "VA", center: [400, 230] }],
      }),
    ).toBeNull();
  });

  it("keeps the target radius stable after zooming and panning", () => {
    expect(
      nearestMapTouchRegion({
        ...map,
        zoom: 2,
        offset: { x: 30, y: -10 },
        pointer: { x: 90, y: 150 },
        regions: [{ code: "VA", center: [280, 250] }],
      }),
    ).toBe("VA");
  });
});

describe("map wheel zoom", () => {
  it("keeps small trackpad deltas precise", () => {
    expect(wheelZoomFactor(-2)).toBeCloseTo(1.0025);
    expect(wheelZoomFactor(2)).toBeCloseTo(1 / 1.0025);
  });

  it("caps large mouse-wheel deltas", () => {
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.06);
    expect(wheelZoomFactor(100)).toBeCloseTo(1 / 1.06);
  });

  it("normalizes line-based wheel events", () => {
    expect(wheelZoomFactor(-1, 1)).toBeCloseTo(1.016);
  });
});

describe("map information panel hysteresis", () => {
  it("keeps a right-side panel until the pointer approaches it", () => {
    expect(mapInfoSideWithHysteresis("right", 600, 700, 980)).toBe("right");
    expect(mapInfoSideWithHysteresis("right", 665, 700, 980)).toBe("left");
  });

  it("keeps a left-side panel until the pointer approaches it", () => {
    expect(mapInfoSideWithHysteresis("left", 500, 20, 300)).toBe("left");
    expect(mapInfoSideWithHysteresis("left", 335, 20, 300)).toBe("right");
  });
});

describe("map country list", () => {
  it("positions the list opposite the information panel", () => {
    expect(oppositeMapInfoSide("left")).toBe("right");
    expect(oppositeMapInfoSide("right")).toBe("left");
  });

  it("sorts localized country names alphabetically without mutating input", () => {
    const regions = [
      { name: "Österreich" },
      { name: "Albanien" },
      { name: "Deutschland" },
    ];

    expect(sortMapRegions(regions, "de").map((region) => region.name)).toEqual([
      "Albanien",
      "Deutschland",
      "Österreich",
    ]);
    expect(regions[0]?.name).toBe("Österreich");
  });
});
