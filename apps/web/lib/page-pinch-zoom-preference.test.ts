import { describe, expect, it } from "vitest";

import {
  parsePagePinchZoomPreference,
  shouldPreventPagePinchZoom,
} from "./page-pinch-zoom-preference";

describe("page pinch zoom preference", () => {
  it("disables page pinch zoom by default", () => {
    expect(parsePagePinchZoomPreference(null)).toBe(false);
    expect(parsePagePinchZoomPreference("disabled")).toBe(false);
  });

  it("allows page pinch zoom when explicitly enabled", () => {
    expect(parsePagePinchZoomPreference("enabled")).toBe(true);
  });

  it("never blocks pinch gestures inside dedicated zoom areas", () => {
    expect(shouldPreventPagePinchZoom(false, true)).toBe(false);
    expect(shouldPreventPagePinchZoom(false, false)).toBe(true);
    expect(shouldPreventPagePinchZoom(true, false)).toBe(false);
  });
});
