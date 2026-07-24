import { describe, expect, it } from "vitest";

import {
  applyRating,
  emptyCardState,
  previewRatings,
  schedulerVersion,
} from "./index";

describe("FSRS scheduler contract", () => {
  const reviewedAt = new Date("2026-07-24T08:00:00.000Z");

  it("is deterministic for the same state and clock", () => {
    const state = emptyCardState(reviewedAt);
    expect(applyRating(state, "GOOD", reviewedAt)).toEqual(
      applyRating(state, "GOOD", reviewedAt),
    );
  });

  it("keeps hard distinct from a forgotten answer", () => {
    const state = emptyCardState(reviewedAt);
    const preview = previewRatings(state, reviewedAt);
    expect(preview.HARD.due).not.toBe(preview.AGAIN.due);
    expect(preview.HARD.learningState).not.toBe("NEW");
  });

  it("persists an explicit implementation version", () => {
    expect(schedulerVersion).toBe("ts-fsrs@5.4.1");
  });
});
