import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  availableStudyLanguageDirections,
  filterStudyCardsByDirection,
  mixedStudyLanguageDirectionCode,
  resolveActiveStudyContentLocale,
  resolveDisplayedStudyLanguageDirection,
  studyLanguageDirectionCode,
  studyLanguageDirectionKey,
  studyLanguageDirectionLabel,
} from "./study-language-direction";

const studySession = readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study language direction", () => {
  it("uses the current deck target while studying all decks", () => {
    expect(
      resolveActiveStudyContentLocale({
        selectedDeckId: "",
        selectedContentLocale: "de",
        activeDeck: {
          targetLocale: "en",
          defaultContentLocale: "en",
          contentLocales: ["en", "de", "fr", "es"],
        },
      }),
    ).toBe("en");
  });

  it("keeps the explicit answer choice for a selected deck", () => {
    expect(
      resolveActiveStudyContentLocale({
        selectedDeckId: "matrix-deck",
        selectedContentLocale: "fr",
        activeDeck: {
          targetLocale: "en",
          defaultContentLocale: "en",
          contentLocales: ["en", "de", "fr", "es"],
        },
      }),
    ).toBe("fr");
  });

  it("uses the explicit pair for an ordinary translation deck", () => {
    const direction = resolveDisplayedStudyLanguageDirection({
      languageMatrix: false,
      sourceLocale: "es",
      targetLocale: "de",
      contentLocales: ["de"],
      contentLocale: "de",
      matrixQuestionLocale: "de",
    });
    expect(direction).toEqual({
      questionLocale: "es",
      answerLocale: "de",
    });
    expect(studyLanguageDirectionCode(direction)).toBe("ES→DE");
    expect(studyLanguageDirectionLabel(direction, "de")).toContain(
      "Fragesprache Spanisch",
    );
  });

  it("shows the selected variant for a localized one-language deck", () => {
    const direction = resolveDisplayedStudyLanguageDirection({
      languageMatrix: false,
      sourceLocale: "en",
      targetLocale: "en",
      contentLocales: ["en", "fr"],
      contentLocale: "fr",
      matrixQuestionLocale: "fr",
    });
    expect(direction).toEqual({
      questionLocale: "fr",
      answerLocale: "fr",
    });
    expect(studyLanguageDirectionCode(direction)).toBe("FR");
  });

  it("shows the active matrix combination", () => {
    const direction = resolveDisplayedStudyLanguageDirection({
      languageMatrix: true,
      sourceLocale: "de",
      targetLocale: "en",
      contentLocales: ["de", "en", "es"],
      contentLocale: "en",
      matrixQuestionLocale: "es",
    });
    expect(studyLanguageDirectionCode(direction)).toBe("ES→EN");
  });

  it("offers both Xefjord directions and a compact mixed code", () => {
    const directions = availableStudyLanguageDirections(
      [
        { questionLocale: "es", answerLocale: "en" },
        { questionLocale: "en", answerLocale: "es" },
        { questionLocale: null, answerLocale: null },
      ],
      ["en", "es"],
    );

    expect(directions).toEqual([
      { questionLocale: "en", answerLocale: "es" },
      { questionLocale: "es", answerLocale: "en" },
    ]);
    expect(mixedStudyLanguageDirectionCode(directions, ["en", "es"])).toBe(
      "EN↔ES",
    );
  });

  it("filters physical cards without merging their scheduler identities", () => {
    const cards = [
      {
        card: {
          id: "recognition-card",
          questionLocale: "en",
          answerLocale: "es",
        },
      },
      {
        card: {
          id: "production-card",
          questionLocale: "es",
          answerLocale: "en",
        },
      },
    ];

    expect(filterStudyCardsByDirection(cards, "mixed")).toEqual(cards);
    expect(
      filterStudyCardsByDirection(
        cards,
        studyLanguageDirectionKey({
          questionLocale: "es",
          answerLocale: "en",
        }),
      ).map((item) => item.card.id),
    ).toEqual(["production-card"]);
  });

  it("uses fixed virtual deck routes instead of an in-card direction popup", () => {
    expect(studySession).toContain("ankiDirectionDecks(selectedDeck)");
    expect(studySession).toContain("fixedStudyDirection");
    expect(studySession).not.toContain("studyDirectionPicker");
    expect(studySession).not.toContain("selectStudyDirection");
    expect(studySession).not.toContain(
      'className="study-language-menu study-card-direction-menu"',
    );
    expect(studySession).toContain('className="study-language-picker"');
    expect(styles).toMatch(
      /\.study-language-picker summary,[\s\S]*?min-width:\s*52px;[\s\S]*?min-height:\s*44px;/,
    );
  });
});
