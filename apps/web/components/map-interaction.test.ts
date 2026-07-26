import { describe, expect, it } from "vitest";

import { isMapDrag } from "./map-interaction";

describe("map drag detection", () => {
  it("keeps a stationary pointer eligible for the card click", () => {
    expect(isMapDrag(100, 100, 103, 102)).toBe(false);
  });

  it("suppresses the card click after panning beyond the threshold", () => {
    expect(isMapDrag(100, 100, 106, 100)).toBe(true);
    expect(isMapDrag(100, 100, 96, 97)).toBe(true);
  });
});
