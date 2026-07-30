import { describe, expect, it } from "vitest";

import {
  shouldDismissStudyPopupOnBlur,
  shouldDismissStudyPopupOnPointerDown,
} from "./study-popup-dismissal";

const inside = new EventTarget();
const outside = new EventTarget();
const containsInside = (target: EventTarget) => target === inside;

describe("study popup dismissal", () => {
  it("keeps the popup open for Safari touch blur without a focus target", () => {
    expect(shouldDismissStudyPopupOnBlur(containsInside, null)).toBe(false);
  });

  it("keeps the popup open while focus moves within it", () => {
    expect(shouldDismissStudyPopupOnBlur(containsInside, inside)).toBe(false);
  });

  it("closes the popup for a concrete keyboard focus target outside", () => {
    expect(shouldDismissStudyPopupOnBlur(containsInside, outside)).toBe(true);
  });

  it("distinguishes inside taps from outside taps", () => {
    expect(shouldDismissStudyPopupOnPointerDown(containsInside, inside)).toBe(
      false,
    );
    expect(shouldDismissStudyPopupOnPointerDown(containsInside, outside)).toBe(
      true,
    );
    expect(shouldDismissStudyPopupOnPointerDown(containsInside, null)).toBe(
      false,
    );
  });
});
