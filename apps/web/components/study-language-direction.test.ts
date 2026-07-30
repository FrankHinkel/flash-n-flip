import { describe, expect, it } from "vitest";

import {
  resolveDisplayedStudyLanguageDirection,
  studyLanguageDirectionCode,
  studyLanguageDirectionLabel,
} from "./study-language-direction";

describe("study language direction", () => {
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
});
