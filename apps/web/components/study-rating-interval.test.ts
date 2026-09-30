import { describe, expect, it } from "vitest";
import {
  applyRating,
  emptyCardState,
  previewRatings,
} from "@flashcards/scheduler";
import { studyRatingInterval } from "./study-rating-interval";

describe("displayed study intervals", () => {
  const now = new Date("2026-09-30T08:00:00Z");
  it("shows the real first learning step instead of a fixed six-day hint", () => {
    const before = emptyCardState(now);
    const preview = previewRatings(before, now);
    expect(studyRatingInterval(preview.GOOD, "en")).toBe("10 min");
    expect(preview.GOOD).toEqual(applyRating(before, "GOOD", now));
    expect(studyRatingInterval(preview.AGAIN, "en")).toBe("1 min");
  });
  it("uses the preview instant and reflects a graduated card's scheduled days", () => {
    const first = applyRating(emptyCardState(now), "GOOD", now);
    const nextAt = new Date(first.due);
    const preview = previewRatings(first, nextAt);
    expect(studyRatingInterval(preview.GOOD, "en")).toBe(
      `${preview.GOOD.scheduledDays} days`,
    );
    expect(studyRatingInterval(preview.GOOD, "de")).toContain("Tage");
    expect(preview.GOOD).toEqual(applyRating(first, "GOOD", nextAt));
  });
  it("formats hour intervals and avoids inventing an interval for invalid state", () => {
    const state = {
      ...emptyCardState(now),
      lastReview: now.toISOString(),
      due: "2026-09-30T10:00:00Z",
    };
    expect(studyRatingInterval(state, "en")).toBe("2 hr");
    expect(studyRatingInterval({ ...state, due: "invalid" }, "en")).toBe("");
  });
});
