import { cardContentSchema } from "@flashcards/domain/content";
import { validateJsxGraphSource } from "@flashcards/domain/jsx-graph";
import { describe, expect, it } from "vitest";

import {
  createFnfHelpLibraryDeckSeeds,
  fnfHelpJsxGraphExamples,
  fnfHelpLibraryCardCount,
  fnfHelpLibraryTemplateKey,
} from "./fnf-help-library";

describe("Flash-n-Flip Help JSXGraph library", () => {
  it("contains a stable root and a substantial JSXGraph reference deck", () => {
    const decks = createFnfHelpLibraryDeckSeeds();
    expect(decks[0]).toMatchObject({
      key: fnfHelpLibraryTemplateKey,
      parentKey: null,
    });
    expect(decks[1]?.parentKey).toBe(fnfHelpLibraryTemplateKey);
    expect(fnfHelpLibraryCardCount).toBeGreaterThanOrEqual(12);
    expect(decks[1]?.cards).toHaveLength(fnfHelpLibraryCardCount);
  });

  it.each(fnfHelpJsxGraphExamples)(
    "validates the bounded $key reference source",
    (example) => {
      expect(
        validateJsxGraphSource(example.source).objectCount,
      ).toBeGreaterThan(0);
    },
  );

  it("stores every example as inert structured card content", () => {
    const cards = createFnfHelpLibraryDeckSeeds().flatMap((deck) => deck.cards);
    for (const card of cards) {
      expect(() => cardContentSchema.parse(card.front)).not.toThrow();
      expect(() => cardContentSchema.parse(card.back)).not.toThrow();
      expect(card.kind).toBe("QUESTION");
    }
  });
});
