import { describe, expect, it } from "vitest";

import type { DeckSummary } from "@flashcards/api-client";

import {
  canonicalDictionaryDecks,
  dictionaryDeckLocale,
  dictionaryLanguageDeckTags,
  languageHubCollectionTags,
  languageHubDeckIsNeutral,
} from "./language-hub";

const dictionaryDeck = (input: {
  id: string;
  locale: string;
  disabled?: boolean;
}): DeckSummary =>
  ({
    id: input.id,
    parentDeckId: "hub",
    title: `Dictionary ${input.locale}`,
    tags: dictionaryLanguageDeckTags({
      locale: input.locale,
      pivotDisabled: input.disabled,
    }),
    sourceLocale: "en",
    targetLocale: input.locale,
    contentLocales: ["en", input.locale],
    sourceTemplateKey: null,
  }) as DeckSummary;

describe("Language Hub metadata", () => {
  it("keeps the collection neutral and each dictionary direction explicit", () => {
    const collectionTags = languageHubCollectionTags(["Xefjord"]);
    const french = dictionaryDeck({ id: "fr", locale: "fr" });

    expect(collectionTags).toContain("Language Neutral");
    expect(
      languageHubDeckIsNeutral({
        tags: collectionTags,
        sourceLocale: "en",
        targetLocale: "en",
      }),
    ).toBe(true);
    expect(dictionaryDeckLocale(french)).toBe("fr");
    expect(french.tags).toContain("dictionary-locale:fr");
  });

  it("uses only one conservative basis for duplicate language imports", () => {
    const canonical = dictionaryDeck({ id: "a-french", locale: "fr" });
    const duplicate = dictionaryDeck({
      id: "b-french",
      locale: "fr",
      disabled: true,
    });
    const german = dictionaryDeck({ id: "c-german", locale: "de" });

    expect(canonicalDictionaryDecks([duplicate, german, canonical])).toEqual([
      canonical,
      german,
    ]);
  });
});
