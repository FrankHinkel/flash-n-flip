import { describe, expect, it } from "vitest";

import { shouldUsePracticeAll } from "./study-practice-mode";

describe("study practice mode", () => {
  it("keeps explicitly requested practice sessions unrated", () => {
    expect(shouldUsePracticeAll(true, [])).toBe(true);
  });

  it("always opens developer references as unrated practice", () => {
    expect(
      shouldUsePracticeAll(false, [
        "KaTeX",
        "Mathematics",
        "Developer reference",
      ]),
    ).toBe(true);
  });

  it("recognizes the reference tag on parent or current source decks", () => {
    expect(
      shouldUsePracticeAll(
        false,
        ["Mathematics"],
        ["KaTeX", "Developer reference"],
      ),
    ).toBe(true);
  });

  it("keeps regular learning decks in rated mode", () => {
    expect(shouldUsePracticeAll(false, ["Mathematics"])).toBe(false);
  });
});
