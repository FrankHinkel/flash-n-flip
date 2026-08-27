import { describe, expect, it } from "vitest";

import { markdownToRichTextDocument } from "@flashcards/domain/markdown";
import { isValidCardContentPair } from "@flashcards/domain/content";

import {
  createPeriodicTableLearningDeckSeeds,
  periodicTableLearningCardCount,
  periodicTableLearningQuestionCount,
} from "./periodic-table-learning-deck.js";

describe("periodic-table learning collection", () => {
  it("separates non-study reference cards from learning questions", () => {
    const decks = createPeriodicTableLearningDeckSeeds();
    const cards = decks.flatMap((deck) => deck.cards);

    expect(decks).toHaveLength(3);
    expect(cards).toHaveLength(periodicTableLearningCardCount);
    expect(cards.filter((card) => card.usage === "LEARNING")).toHaveLength(
      periodicTableLearningQuestionCount,
    );
    expect(
      cards
        .filter((card) => card.usage === "REFERENCE")
        .every((card) => card.kind === "EXPLANATION"),
    ).toBe(true);
    expect(decks[1]?.tags).toContain("Developer reference");
    expect(
      cards.every((card) =>
        isValidCardContentPair(card.kind, card.front, card.back),
      ),
    ).toBe(true);
  });

  it("uses only parseable periodic-table fences", () => {
    for (const card of createPeriodicTableLearningDeckSeeds().flatMap(
      (deck) => deck.cards,
    )) {
      for (const content of [card.front, card.back]) {
        for (const block of content.blocks) {
          if (block.type === "markdown") {
            expect(() =>
              markdownToRichTextDocument(block.source),
            ).not.toThrow();
          }
        }
      }
    }
  });
});
