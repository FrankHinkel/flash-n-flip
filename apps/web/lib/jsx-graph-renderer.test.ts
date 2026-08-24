import { describe, expect, it } from "vitest";

import { jsxGraphDisplayName } from "./jsx-graph-renderer";

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
