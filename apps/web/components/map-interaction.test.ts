import { describe, expect, it } from "vitest";

import { isMapDrag, wheelZoomFactor } from "./map-interaction";

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
