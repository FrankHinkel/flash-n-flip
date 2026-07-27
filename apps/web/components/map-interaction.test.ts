import { describe, expect, it } from "vitest";

import {
  isMapDrag,
  mapInfoSideWithHysteresis,
  oppositeMapInfoSide,
  sortMapRegions,
  wheelZoomFactor,
} from "./map-interaction";

describe("map drag detection", () => {
  it("keeps a stationary pointer eligible for the card click", () => {
    expect(isMapDrag(100, 100, 103, 102)).toBe(false);
  });

  it("suppresses the card click after panning beyond the threshold", () => {
    expect(isMapDrag(100, 100, 106, 100)).toBe(true);
    expect(isMapDrag(100, 100, 96, 97)).toBe(true);
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
