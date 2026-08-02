import { describe, expect, it } from "vitest";

import {
  defaultStudyHref,
  normalizeStudyHref,
  resolveStudyRouteSelection,
  studyHrefForDeck,
  studyHrefToRemember,
  studySessionIdentity,
} from "./study-navigation";

describe("study navigation", () => {
  it("creates a new session identity when the selected deck changes", () => {
    expect(studySessionIdentity("deck-one", false)).not.toBe(
      studySessionIdentity("deck-two", false),
    );
    expect(studySessionIdentity("deck-one", true)).toBe("deck-one:all");
  });

  it("opens the clicked deck after an offline shell started with another deck", () => {
    const clickedHref = studyHrefForDeck("deck-two");
    const clickedSearch = new URL(clickedHref, "https://flash-n-flip.invalid")
      .searchParams;

    expect(
      resolveStudyRouteSelection(clickedSearch, {
        deckId: "deck-one",
        practiceAll: false,
      }),
    ).toEqual({ deckId: "deck-two", practiceAll: false });
  });

  it("uses server fallbacks only when the live URL omits study parameters", () => {
    expect(
      resolveStudyRouteSelection(new URLSearchParams(), {
        deckId: "deck-one",
        practiceAll: true,
      }),
    ).toEqual({ deckId: "deck-one", practiceAll: true });
    expect(
      resolveStudyRouteSelection(new URLSearchParams("deckId=&practice=due"), {
        deckId: "deck-one",
        practiceAll: true,
      }),
    ).toEqual({ deckId: "", practiceAll: false });
  });

  it("restores the last selected deck and supported practice mode", () => {
    expect(
      normalizeStudyHref(
        "/app/learn?practice=all&deckId=world%2Feurope&ignored=true",
      ),
    ).toBe("/app/learn?deckId=world%2Feurope&practice=all");
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
