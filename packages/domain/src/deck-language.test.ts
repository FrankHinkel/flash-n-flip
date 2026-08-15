import { describe, expect, it } from "vitest";

import {
  resolveCardLanguageDirection,
  resolveDeckLanguageDirection,
} from "./index";

describe("deck language direction", () => {
  it("uses one supplied language for both sides", () => {
    expect(
      resolveDeckLanguageDirection({
        sourceLocale: "es",
        fallbackLocale: "en",
      }),
    ).toEqual({ sourceLocale: "es", targetLocale: "es" });
  });

  it("keeps an explicit translation direction", () => {
    expect(
      resolveDeckLanguageDirection({
        sourceLocale: "es",
        targetLocale: "de",
        fallbackLocale: "en",
      }),
    ).toEqual({ sourceLocale: "es", targetLocale: "de" });
  });

  it("falls back both sides for legacy data without a language direction", () => {
    expect(
      resolveDeckLanguageDirection({
        fallbackLocale: "fr",
      }),
    ).toEqual({ sourceLocale: "fr", targetLocale: "fr" });
  });
});

describe("card language direction", () => {
  it("uses card overrides when an imported card reverses the deck default", () => {
    expect(
      resolveCardLanguageDirection({
        questionLocale: "es",
        answerLocale: "en",
        sourceLocale: "en",
        targetLocale: "es",
      }),
    ).toEqual({ questionLocale: "es", answerLocale: "en" });
  });

  it("falls back to the deck direction for ordinary cards", () => {
    expect(
      resolveCardLanguageDirection({
        questionLocale: null,
        answerLocale: null,
        sourceLocale: "fr",
        targetLocale: "de",
      }),
    ).toEqual({ questionLocale: "fr", answerLocale: "de" });
  });

  it("applies a changed deck direction without rewriting ordinary cards", () => {
    expect(
      resolveCardLanguageDirection({
        questionLocale: "en",
        answerLocale: "de",
        sourceLocale: "fr",
        targetLocale: "es",
        baseSourceLocale: "en",
        baseTargetLocale: "de",
        mode: "DECK_DEFAULT",
      }),
    ).toEqual({ questionLocale: "fr", answerLocale: "es" });
  });

  it("keeps reversed cards reversed after an inherited direction changes", () => {
    expect(
      resolveCardLanguageDirection({
        questionLocale: "de",
        answerLocale: "en",
        sourceLocale: "fr",
        targetLocale: "es",
        baseSourceLocale: "en",
        baseTargetLocale: "de",
        mode: "DECK_REVERSED",
      }),
    ).toEqual({ questionLocale: "es", answerLocale: "fr" });
  });

  it("collapses both card sides to one language for monolingual decks", () => {
    expect(
      resolveCardLanguageDirection({
        sourceLocale: "de",
        targetLocale: "de",
        mode: "DECK_DEFAULT",
      }),
    ).toEqual({ questionLocale: "de", answerLocale: "de" });
  });
});
