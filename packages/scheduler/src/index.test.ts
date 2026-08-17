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
    expect(schedulerVersion).toBe("flash-n-flip-fsrs@2/ts-fsrs@5.4.1");
  });

  it("graduates a good new card after its persisted learning step", () => {
    const first = applyRating(emptyCardState(reviewedAt), "GOOD", reviewedAt);
    expect(first).toMatchObject({
      learningState: "LEARNING",
      learningSteps: 1,
    });

    const second = applyRating(first, "GOOD", new Date(first.due));
    expect(second.learningState).toBe("REVIEW");
    expect(second.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it("recovers the missing learning step from a legacy persisted state", () => {
    const first = applyRating(emptyCardState(reviewedAt), "GOOD", reviewedAt);
    const { learningSteps: _discarded, ...legacyState } = first;

    const migrated = applyRating(legacyState, "GOOD", new Date(first.due));
    expect(migrated.learningState).toBe("REVIEW");
    expect(migrated.learningSteps).toBe(0);
  });
});
