import { describe, expect, it } from "vitest";

import {
  jsxGraphDeterministicRandom,
  jsxGraphDefaultFillOpacity,
  jsxGraphDisplayName,
  jsxGraphPointFace,
  jsxGraphRiemannMethod,
  jsxGraphSliderInteractionAttributes,
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
});
