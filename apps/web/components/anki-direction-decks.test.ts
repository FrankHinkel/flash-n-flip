import { describe, expect, it } from "vitest";

import type { DeckSummary } from "@flashcards/api-client";

import {
  ankiDirectionDecks,
  ankiMixedDeckTitle,
  isAnkiLanguageDeck,
} from "./anki-direction-decks";

const deck = (overrides: Partial<DeckSummary> = {}): DeckSummary => ({
  id: "deck-is",
  parentDeckId: null,
  title: "Xefjord's Complete Icelandic",
  description: "",
  language: "is",
  contentLocales: ["is"],
  defaultContentLocale: "is",
  sourceLocale: "en",
  targetLocale: "is",
  protectionMode: "ACCOUNT_BOUND",
  tags: ["Anki Import"],
  favorite: false,
  hiddenAt: null,
  archivedAt: null,
  visual: null,
  sourceTemplateKey: null,
  version: 1,
  updatedAt: "2026-08-06T00:00:00.000Z",
  cardCount: 428,
  reviewedCardCount: 2,
  cardDirections: {
    "is→en": { cardCount: 214, reviewedCardCount: 1 },
    "en→is": { cardCount: 214, reviewedCardCount: 1 },
  },
  storageBytes: 1024,
  ...overrides,
});

describe("Anki virtual direction decks", () => {
  it("creates two exact reverse-language views over one physical deck", () => {
    const physical = deck();

    expect(isAnkiLanguageDeck(physical)).toBe(true);
    expect(ankiMixedDeckTitle(physical)).toBe("Icelandic (EN↔IS)");
    expect(ankiDirectionDecks(physical)).toEqual([
      {
        direction: { questionLocale: "en", answerLocale: "is" },
        directionKey: "en→is",
        title: "Icelandic (EN→IS)",
        cardCount: 214,
        reviewedCardCount: 1,
      },
      {
        direction: { questionLocale: "is", answerLocale: "en" },
        directionKey: "is→en",
        title: "Icelandic (IS→EN)",
        cardCount: 214,
        reviewedCardCount: 1,
      },
    ]);
  });

  it("also exposes proven directions for ordinary bilingual Anki imports", () => {
    const physical = deck({ title: "My vocabulary" });

    expect(ankiMixedDeckTitle(physical)).toBe("My vocabulary (EN↔IS)");
    expect(ankiDirectionDecks(physical)).toHaveLength(2);
  });

  it("does not invent views without two proven reverse counts", () => {
    expect(
      ankiDirectionDecks(
        deck({
          cardDirections: {
            "en→is": { cardCount: 214, reviewedCardCount: 1 },
          },
        }),
      ),
    ).toEqual([]);
    expect(
      ankiDirectionDecks(
        deck({
          tags: [],
        }),
      ),
    ).toEqual([]);
  });
});
