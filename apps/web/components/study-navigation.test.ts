import { describe, expect, it } from "vitest";

import {
  defaultStudyHref,
  normalizeStudyHref,
  resolveHydratedStudyRouteSelection,
  resolveStudyRouteSelection,
  studyHrefForDeck,
  studyHrefForXefjordCrossLanguage,
  studyHrefToPreserveAcrossOfflineReload,
  studyHrefToRemember,
  studySessionIdentity,
} from "./study-navigation";

const fallback = (
  overrides: Partial<{
    deckId: string;
    practiceAll: boolean;
    direction: string;
    xefjordSourceDeckId: string;
    xefjordTargetDeckId: string;
    xefjordMode: string;
    xefjordQuestionEnglish: boolean;
    xefjordAnswerEnglish: boolean;
  }> = {},
) => ({
  deckId: "",
  practiceAll: false,
  direction: "",
  xefjordSourceDeckId: "",
  xefjordTargetDeckId: "",
  xefjordMode: "",
  xefjordQuestionEnglish: false,
  xefjordAnswerEnglish: false,
  ...overrides,
});

describe("study navigation", () => {
  it("creates a new session identity when the selected deck changes", () => {
    expect(studySessionIdentity("deck-one", false)).not.toBe(
      studySessionIdentity("deck-two", false),
    );
    expect(studySessionIdentity("deck-one", true)).toBe("deck-one:all");
    expect(studySessionIdentity("deck-one", false, "en→is")).not.toBe(
      studySessionIdentity("deck-one", false, "is→en"),
    );
  });

  it("opens the clicked deck after an offline shell started with another deck", () => {
    const clickedHref = studyHrefForDeck("deck-two");
    const clickedSearch = new URL(clickedHref, "https://flash-n-flip.invalid")
      .searchParams;

    expect(
      resolveStudyRouteSelection(
        clickedSearch,
        fallback({ deckId: "deck-one" }),
      ),
    ).toEqual(fallback({ deckId: "deck-two" }));
  });

  it("recovers the clicked deck from the real URL after a generic cached shell loads", () => {
    expect(
      resolveHydratedStudyRouteSelection(
        "?deckId=africa-countries",
        null,
        fallback(),
      ),
    ).toEqual(fallback({ deckId: "africa-countries" }));
  });

  it("recovers a pending offline deck when the cached router loses the query", () => {
    expect(
      resolveHydratedStudyRouteSelection(
        "",
        "/app/learn?deckId=africa-countries&practice=all&direction=en%E2%86%92is",
        fallback({ deckId: "first-deck" }),
      ),
    ).toEqual(
      fallback({
        deckId: "africa-countries",
        practiceAll: true,
        direction: "en→is",
      }),
    );
  });

  it("preserves only same-origin deck-specific study destinations", () => {
    expect(
      studyHrefToPreserveAcrossOfflineReload(
        new URL("https://flash-n-flip.com/app/learn?deckId=africa%3Acountries"),
        "https://flash-n-flip.com",
      ),
    ).toBe("/app/learn?deckId=africa%3Acountries");
    expect(
      studyHrefToPreserveAcrossOfflineReload(
        new URL("https://other.test/app/learn?deckId=private"),
        "https://flash-n-flip.com",
      ),
    ).toBeNull();
    expect(
      studyHrefToPreserveAcrossOfflineReload(
        new URL("https://flash-n-flip.com/app/decks?deckId=private"),
        "https://flash-n-flip.com",
      ),
    ).toBeNull();
  });

  it("uses server fallbacks only when the live URL omits study parameters", () => {
    expect(
      resolveStudyRouteSelection(
        new URLSearchParams(),
        fallback({
          deckId: "deck-one",
          practiceAll: true,
          direction: "en→is",
        }),
      ),
    ).toEqual(
      fallback({ deckId: "deck-one", practiceAll: true, direction: "en→is" }),
    );
    expect(
      resolveStudyRouteSelection(
        new URLSearchParams("deckId=&practice=due"),
        fallback({
          deckId: "deck-one",
          practiceAll: true,
          direction: "en→is",
        }),
      ),
    ).toEqual(fallback({ direction: "en→is" }));
  });

  it("preserves a virtual Xefjord pair and gives every direction its own session", () => {
    const href = studyHrefForXefjordCrossLanguage({
      collectionDeckId: "collection",
      sourceDeckId: "de",
      targetDeckId: "is",
      mode: "SOURCE_TO_TARGET",
      questionEnglish: true,
      answerEnglish: true,
    });
    expect(normalizeStudyHref(href)).toBe(href);
    expect(
      studySessionIdentity(
        "collection",
        false,
        "",
        "de",
        "is",
        "SOURCE_TO_TARGET",
        true,
        true,
      ),
    ).not.toBe(
      studySessionIdentity(
        "collection",
        false,
        "",
        "de",
        "is",
        "TARGET_TO_SOURCE",
        true,
        true,
      ),
    );
  });

  it("restores the last selected deck and supported practice mode", () => {
    expect(
      normalizeStudyHref(
        "/app/learn?practice=all&deckId=world%2Feurope&direction=en%E2%86%92is&ignored=true",
      ),
    ).toBe(
      "/app/learn?deckId=world%2Feurope&practice=all&direction=en%E2%86%92is",
    );
  });

  it("rejects external, unrelated, and deckless destinations", () => {
    expect(
      normalizeStudyHref("https://example.com/app/learn?deckId=world"),
    ).toBe(defaultStudyHref);
    expect(normalizeStudyHref("/community?deckId=world")).toBe(
      defaultStudyHref,
    );
    expect(normalizeStudyHref("/app/learn?practice=all")).toBe(
      defaultStudyHref,
    );
  });

  it("only remembers learning routes with an explicit deck", () => {
    expect(studyHrefToRemember("/app/learn", "deckId=europe")).toBe(
      "/app/learn?deckId=europe",
    );
    expect(studyHrefToRemember("/app/learn", "")).toBeNull();
  });
});
