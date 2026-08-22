import { describe, expect, it } from "vitest";

import { clampMermaidScale, mermaidPinchScale } from "./mermaid-gesture";

describe("Mermaid gesture scaling", () => {
  it("zooms proportionally for a two-pointer pinch", () => {
    expect(mermaidPinchScale(1, 100, 150)).toBe(1.5);
    expect(mermaidPinchScale(1.2, 120, 60)).toBe(0.6);
  });

  it("keeps wheel, keyboard, and pinch zoom within safe bounds", () => {
    expect(clampMermaidScale(0.1)).toBe(0.6);
    expect(clampMermaidScale(8)).toBe(3);
    expect(mermaidPinchScale(1, 0, 200)).toBe(1);
  });
});
