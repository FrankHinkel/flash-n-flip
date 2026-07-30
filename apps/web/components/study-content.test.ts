import { describe, expect, it } from "vitest";

import type { CardContent } from "@flashcards/domain/content";

import {
  applyMapQuizSelection,
  completedClozeIds,
  errorCountAfterClozeHint,
  firstStudyContentHeading,
  hasStudyMap,
  interactiveClozeIds,
  isRatingAllowedAfterErrors,
  resolveQuestionLocale,
  selectedStudyCountryCode,
  selectedStudyMapRegionCode,
  shouldRevealMapQuiz,
  studyContentLocaleForSide,
  visibleStudyContentBlocks,
} from "./study-content";

const mapContent: CardContent = {
  blocks: [
    { type: "heading", level: 2, text: "Which country is highlighted?" },
    {
      type: "geographyMap",
      mapId: "europe",
      label: "Map of Europe",
      selectedRegionCode: "DE",
      interactive: false,
      overlays: [],
      targets: [],
    },
  ],
};

describe("study content layout helpers", () => {
  it("balances random question languages while excluding the answer language", () => {
    const locales = ["en", "de", "fr", "es"];
    expect(
      [0, 1, 2, 3, 4, 5].map((index) =>
        resolveQuestionLocale("random", "en", locales, index),
      ),
    ).toEqual(["de", "fr", "es", "de", "fr", "es"]);
    expect(resolveQuestionLocale("fr", "en", locales, 8)).toBe("fr");
    expect(resolveQuestionLocale("en", "en", locales, 0)).toBe("de");
  });

  it("keeps language-matrix question and answer speech locales separate", () => {
    expect(studyContentLocaleForSide("question", "es", "de", true)).toBe("es");
    expect(studyContentLocaleForSide("answer", "es", "de", true)).toBe("de");
    expect(studyContentLocaleForSide("answer", "es", "de", false)).toBe("es");
  });

  it("extracts only a leading heading for the compact card top bar", () => {
    expect(firstStudyContentHeading(mapContent)).toEqual({
      level: 2,
      text: "Which country is highlighted?",
    });
    expect(
      firstStudyContentHeading({
        blocks: [
          { type: "text", text: "Question" },
          { type: "heading", level: 3, text: "Later heading" },
        ],
      }),
    ).toBeNull();
  });

  it("removes the extracted heading from the rendered body without mutation", () => {
    const visibleBlocks = visibleStudyContentBlocks(mapContent, true);

    expect(visibleBlocks).toHaveLength(1);
    expect(visibleBlocks[0]?.type).toBe("geographyMap");
    expect(mapContent.blocks).toHaveLength(2);
  });

  it("detects both supported map block types", () => {
    expect(hasStudyMap(mapContent)).toBe(true);
    expect(
      hasStudyMap({
        blocks: [
          {
            type: "europeMap",
            label: "Map of Europe",
            interactive: true,
            targets: [],
          },
        ],
      }),
    ).toBe(true);
    expect(
      hasStudyMap({ blocks: [{ type: "text", text: "Plain card" }] }),
    ).toBe(false);
  });

  it("extracts the selected region used by both map card formats", () => {
    expect(selectedStudyMapRegionCode(mapContent)).toBe("DE");
    expect(
      selectedStudyMapRegionCode({
        blocks: [
          {
            type: "europeMap",
            label: "Europe",
            selectedCountryCode: "FR",
            interactive: false,
            targets: [],
          },
        ],
      }),
    ).toBe("FR");
    expect(
      selectedStudyMapRegionCode({
        blocks: [{ type: "text", text: "No map" }],
      }),
    ).toBeNull();
  });

  it("selects answer previews only for country-level map cards", () => {
    expect(selectedStudyCountryCode(mapContent)).toBe("DE");
    expect(
      selectedStudyCountryCode({
        blocks: [
          {
            type: "europeMap",
            label: "Europe",
            selectedCountryCode: "FR",
            interactive: false,
            targets: [],
          },
        ],
      }),
    ).toBe("FR");
    expect(
      selectedStudyCountryCode({
        blocks: [
          {
            type: "geographyMap",
            mapId: "germany-states",
            label: "Germany",
            selectedRegionCode: "DE-BY",
            interactive: false,
            overlays: [],
            targets: [],
          },
        ],
      }),
    ).toBeNull();
    expect(
      selectedStudyCountryCode({
        blocks: [
          {
            type: "geographyMap",
            mapId: "world",
            label: "World",
            selectedRegionCode: "EU",
            interactive: false,
            overlays: [],
            targets: [],
          },
        ],
      }),
    ).toBeNull();
  });

  it("collects interactive clozes with stable block-qualified ids", () => {
    expect(
      interactiveClozeIds({
        blocks: [
          { type: "text", text: "Introduction" },
          {
            type: "richText",
            revealMode: "SEQUENTIAL",
            document: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "cloze",
                      attrs: {
                        id: "verb",
                        answer: "sind",
                        choices: ["sind", "bist", "bin"],
                        order: 1,
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    ).toEqual(["1:verb"]);
  });

  it("does not crash the study session for invalid persisted cloze positions", () => {
    expect(
      interactiveClozeIds({
        blocks: [
          {
            type: "markdown",
            revealMode: "SEQUENTIAL",
            source: "{{1:a}}\n{{1:b}}",
          },
        ],
      }),
    ).toEqual([]);
  });

  it("removes one positive rating level for every wrong cloze choice", () => {
    expect(isRatingAllowedAfterErrors("EASY", 0)).toBe(true);
    expect(isRatingAllowedAfterErrors("EASY", 1)).toBe(false);
    expect(isRatingAllowedAfterErrors("GOOD", 1)).toBe(true);
    expect(isRatingAllowedAfterErrors("GOOD", 2)).toBe(false);
    expect(isRatingAllowedAfterErrors("HARD", 2)).toBe(true);
    expect(isRatingAllowedAfterErrors("HARD", 3)).toBe(false);
    expect(isRatingAllowedAfterErrors("AGAIN", 3)).toBe(true);
  });

  it("treats a cloze speech hint as exactly the first restriction level", () => {
    expect(errorCountAfterClozeHint(0)).toBe(1);
    expect(errorCountAfterClozeHint(1)).toBe(1);
    expect(errorCountAfterClozeHint(2)).toBe(2);
    expect(
      isRatingAllowedAfterErrors("EASY", errorCountAfterClozeHint(0)),
    ).toBe(false);
    expect(
      isRatingAllowedAfterErrors("GOOD", errorCountAfterClozeHint(0)),
    ).toBe(true);
  });

  it("reveals a map quiz after the correct region while preserving prior errors", () => {
    const initial = { cardKey: "", errors: 0, solved: false };
    const wrong = applyMapQuizSelection(initial, "card-1", "DE", "FR");
    const correct = applyMapQuizSelection(wrong, "card-1", "DE", "DE");

    expect(wrong).toEqual({
      cardKey: "card-1",
      errors: 1,
      solved: false,
    });
    expect(correct).toEqual({
      cardKey: "card-1",
      errors: 1,
      solved: true,
    });
    expect(shouldRevealMapQuiz(correct, "card-1")).toBe(true);
    expect(isRatingAllowedAfterErrors("EASY", correct.errors)).toBe(false);
    expect(isRatingAllowedAfterErrors("GOOD", correct.errors)).toBe(true);
  });

  it("caps map quiz errors and reveals automatically on the third miss", () => {
    let progress = { cardKey: "", errors: 0, solved: false };
    progress = applyMapQuizSelection(progress, "card-1", "DE", "FR");
    progress = applyMapQuizSelection(progress, "card-1", "DE", "ES");
    progress = applyMapQuizSelection(progress, "card-1", "DE", "IT");
    progress = applyMapQuizSelection(progress, "card-1", "DE", "PL");

    expect(progress.errors).toBe(3);
    expect(shouldRevealMapQuiz(progress, "card-1")).toBe(true);
    expect(isRatingAllowedAfterErrors("HARD", progress.errors)).toBe(false);
    expect(isRatingAllowedAfterErrors("AGAIN", progress.errors)).toBe(true);
  });

  it("completes all clozes together only in the ALL reveal mode", () => {
    expect(completedClozeIds("ALL", ["first", "second"], "first")).toEqual([
      "first",
      "second",
    ]);
    expect(
      completedClozeIds("SEQUENTIAL", ["first", "second"], "first"),
    ).toEqual(["first"]);
  });
});
