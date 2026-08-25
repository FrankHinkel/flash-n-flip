import { describe, expect, it } from "vitest";

import {
  jsxGraphDeterministicRandom,
  jsxGraphDefaultFillOpacity,
  jsxGraphDisplayName,
  jsxGraphPointFace,
  jsxGraphRiemannMethod,
  jsxGraphSliderInteractionAttributes,
  scaledJsxGraphBoundingBox,
} from "./jsx-graph-renderer";

describe("jsxGraphDisplayName", () => {
  it("keeps assigned and explicitly authored labels visible", () => {
    expect(jsxGraphDisplayName(undefined, "A", true)).toBe("A");
    expect(jsxGraphDisplayName("Punkt", "jsxgraph-9", false)).toBe("Punkt");
  });

  it("hides generated names for unassigned objects", () => {
    expect(jsxGraphDisplayName(undefined, "jsxgraph-9", false)).toBe("");
  });

  it("allows an explicitly empty name to hide an assigned label", () => {
    expect(jsxGraphDisplayName("", "A", true)).toBe("");
  });
});

describe("safe JSXGraph extensions", () => {
  it("maps point faces and bounded Riemann methods", () => {
    expect(jsxGraphPointFace("square")).toBe("[]");
    expect(jsxGraphPointFace("triangleUp")).toBe("^");
    expect(jsxGraphRiemannMethod("middle")).toBe("middle");
    expect(() => jsxGraphPointFace("html")).toThrow(/face/);
    expect(() => jsxGraphRiemannMethod("random")).toThrow(/method/);
  });

  it("keeps points filled while curves and circles remain transparent", () => {
    expect(jsxGraphDefaultFillOpacity("point")).toBe(1);
    expect(jsxGraphDefaultFillOpacity("polygon")).toBeGreaterThan(0);
    expect(jsxGraphDefaultFillOpacity("circle")).toBe(0);
    expect(jsxGraphDefaultFillOpacity("circumcircle")).toBe(0);
  });

  it("creates reproducible pseudo-random starting values", () => {
    const first = jsxGraphDeterministicRandom(5, 10, 42);
    expect(first).toBeGreaterThanOrEqual(5);
    expect(first).toBeLessThanOrEqual(10);
    expect(jsxGraphDeterministicRandom(5, 10, 42)).toBe(first);
    expect(jsxGraphDeterministicRandom(5, 10, 43)).not.toBe(first);
  });

  it("keeps slider release events isolated to the dragged handle", () => {
    expect(jsxGraphSliderInteractionAttributes(0.05)).toEqual({
      fixed: false,
      moveOnUp: false,
      snapWidth: 0.05,
      tabIndex: 0,
    });
  });

  it("scales board content around the original center", () => {
    expect(scaledJsxGraphBoundingBox([-4, 3, 4, -3], 100)).toEqual([
      -4, 3, 4, -3,
    ]);
    expect(scaledJsxGraphBoundingBox([-4, 3, 4, -3], 200)).toEqual([
      -2, 1.5, 2, -1.5,
    ]);
    expect(scaledJsxGraphBoundingBox([-4, 3, 4, -3], 50)).toEqual([
      -8, 6, 8, -6,
    ]);
  });
});
