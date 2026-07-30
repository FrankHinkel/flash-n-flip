import { describe, expect, it } from "vitest";

import { parseStudyQuestionPreference } from "./study-question-preference";

describe("study question preference", () => {
  it("shows the question with the answer by default", () => {
    expect(parseStudyQuestionPreference(null)).toBe(true);
    expect(parseStudyQuestionPreference("unexpected")).toBe(true);
    expect(parseStudyQuestionPreference("visible")).toBe(true);
  });

  it("hides the question only after an explicit choice", () => {
    expect(parseStudyQuestionPreference("hidden")).toBe(false);
  });
});
