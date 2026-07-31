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
});
