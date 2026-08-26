import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultStudyAnswerSplit,
  loadStudyAnswerSplit,
  saveStudyAnswerSplit,
  studyAnswerSplitPreferenceKey,
} from "./study-answer-split-preference";

describe("study answer split preference", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("persists a clamped percentage locally", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    saveStudyAnswerSplit(95);

    expect(values.get(studyAnswerSplitPreferenceKey)).toBe("70");
    expect(loadStudyAnswerSplit()).toBe(70);
  });

  it("falls back when storage is unavailable", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });

    expect(loadStudyAnswerSplit()).toBe(defaultStudyAnswerSplit);
  });
});
