import { describe, expect, it } from "vitest";

import {
  isShowAnswerReady,
  showAnswerDelayMs,
  studyRevealKey,
} from "./study-answer-delay";

describe("study answer reveal protection", () => {
  it("uses a global delay between one and two seconds", () => {
    expect(showAnswerDelayMs).toBeGreaterThanOrEqual(1_000);
    expect(showAnswerDelayMs).toBeLessThanOrEqual(2_000);
  });

  it("binds readiness to the exact card and learning presentation", () => {
    const key = studyRevealKey({
      cardId: "card-a",
      contentLocale: "de",
      mode: "cards",
      difficulty: "recognize",
    });
    expect(isShowAnswerReady(key, key)).toBe(true);
    expect(
      isShowAnswerReady(
        studyRevealKey({
          cardId: "card-b",
          contentLocale: "de",
          mode: "cards",
          difficulty: "recognize",
        }),
        key,
      ),
    ).toBe(false);
    expect(
      isShowAnswerReady(
        studyRevealKey({
          cardId: "card-a",
          contentLocale: "en",
          mode: "cards",
          difficulty: "recognize",
        }),
        key,
      ),
    ).toBe(false);
  });

  it("never unlocks an empty card", () => {
    expect(isShowAnswerReady("", "")).toBe(false);
  });
});
