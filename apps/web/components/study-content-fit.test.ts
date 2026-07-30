import { describe, expect, it } from "vitest";

import {
  calculateStudyContentScale,
  minimumStudyContentScale,
} from "./study-content-fit";

describe("study content auto fit", () => {
  it("keeps content at its natural size when it fits", () => {
    expect(
      calculateStudyContentScale({
        availableWidth: 360,
        availableHeight: 500,
        contentWidth: 320,
        contentHeight: 480,
      }),
    ).toBe(1);
  });

  it("shrinks content according to the tighter dimension", () => {
    expect(
      calculateStudyContentScale({
        availableWidth: 360,
        availableHeight: 400,
        contentWidth: 400,
        contentHeight: 500,
      }),
    ).toBe(0.8);
  });

  it("never shrinks below the legibility floor", () => {
    expect(
      calculateStudyContentScale({
        availableWidth: 320,
        availableHeight: 300,
        contentWidth: 900,
        contentHeight: 1200,
      }),
    ).toBe(minimumStudyContentScale);
  });
});
