import { describe, expect, it } from "vitest";

import {
  filterLearningCards,
  resolveEmptyStudyQueue,
  shouldBrowseDeveloperReferences,
  shouldUsePracticeAll,
} from "./study-practice-mode";

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

  it("keeps references out of normal and practice-all learning runs", () => {
    const cards = [
      { card: { deckId: "learning" }, studyMode: "LEARNING" as const },
      { card: { deckId: "reference" }, studyMode: "REFERENCE" as const },
    ];

    expect(filterLearningCards(cards, false, new Set())).toEqual([cards[0]]);
    expect(filterLearningCards(cards, false, new Set(["reference"]))).toEqual([
      cards[0],
    ]);
  });

  it("preserves direct reference browsing without ratings", () => {
    const cards = [
      { card: { deckId: "reference" }, studyMode: "REFERENCE" as const },
    ];

    expect(
      shouldBrowseDeveloperReferences(
        "reference",
        ["Developer reference"],
        cards,
      ),
    ).toBe(true);
    expect(filterLearningCards(cards, true, new Set())).toEqual(cards);
  });

  it("recognizes an offline cached reference-only scope", () => {
    expect(
      shouldBrowseDeveloperReferences("reference", undefined, [
        { card: { deckId: "reference" }, studyMode: "REFERENCE" },
      ]),
    ).toBe(true);
  });

  it("opens an untagged reference-only selection instead of reporting done", () => {
    const references = [
      { card: { deckId: "reference" }, studyMode: "REFERENCE" as const },
    ];

    expect(resolveEmptyStudyQueue("reference", undefined, references)).toEqual(
      references,
    );
  });

  it("does not turn completed learning cards into an unscheduled session", () => {
    expect(
      resolveEmptyStudyQueue("learning", undefined, [
        { card: { deckId: "learning" }, studyMode: "LEARNING" },
      ]),
    ).toEqual([]);
  });
});
