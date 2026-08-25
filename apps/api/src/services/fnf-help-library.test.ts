import { cardContentSchema } from "@flashcards/domain/content";
import { validateJsxGraphSource } from "@flashcards/domain/jsx-graph";
import {
  mermaidDiagramTypeFromSource,
  validateMermaidDiagramSource,
} from "@flashcards/domain/mermaid-diagram";
import { validateMusicScoreAbc } from "@flashcards/domain/music-score";
import { describe, expect, it } from "vitest";

import {
  createFnfHelpLibraryDeckSeeds,
  fnfHelpAbcExamples,
  fnfHelpJsxGraphExamples,
  fnfHelpLibraryExampleCount,
  fnfHelpLibraryCardCount,
  fnfHelpLibraryTemplateKey,
  fnfHelpMermaidExamples,
} from "./fnf-help-library";

describe("Flash-n-Flip Help reference library", () => {
  it("contains a stable root and three English reference subdecks", () => {
    const decks = createFnfHelpLibraryDeckSeeds();
    expect(decks[0]).toMatchObject({
      key: fnfHelpLibraryTemplateKey,
      parentKey: null,
    });
    expect(decks.slice(1)).toHaveLength(3);
    expect(
      decks.slice(1).every((deck) => deck.parentKey === decks[0]!.key),
    ).toBe(true);
    expect(decks.map((deck) => deck.title)).toEqual([
      "Flash-n-Flip Help",
      expect.stringContaining("JSXGraph"),
      expect.stringContaining("Mermaid"),
      expect.stringContaining("ABC"),
    ]);
    expect(fnfHelpLibraryExampleCount).toBeGreaterThanOrEqual(50);
    expect(fnfHelpLibraryCardCount).toBeGreaterThan(fnfHelpLibraryExampleCount);
    for (const deck of decks.slice(1)) {
      expect(deck.cards[0]?.key).toBe("intro-welcome");
      expect(deck.cards[1]?.key).toBe("intro-structure");
    }
  });

  it("contains forty distinct JSXGraph examples", () => {
    expect(fnfHelpJsxGraphExamples).toHaveLength(40);
    expect(new Set(fnfHelpJsxGraphExamples.map(({ key }) => key)).size).toBe(
      40,
    );
  });

  it.each(fnfHelpJsxGraphExamples)(
    "validates the bounded $key reference source",
    (example) => {
      expect(
        validateJsxGraphSource(example.source).objectCount,
      ).toBeGreaterThan(0);
    },
  );

  it.each(fnfHelpMermaidExamples)(
    "validates the bounded Mermaid $key reference source",
    (example) => {
      const type = mermaidDiagramTypeFromSource(example.source);
      expect(type).not.toBeNull();
      expect(() =>
        validateMermaidDiagramSource(example.source, type!),
      ).not.toThrow();
    },
  );

  it.each(fnfHelpAbcExamples)(
    "validates the bounded ABC $key reference source",
    (example) => {
      expect(validateMusicScoreAbc(example.source).eventCount).toBeGreaterThan(
        0,
      );
    },
  );

  it("includes two substantial complete piano reference scores", () => {
    const completeScores = fnfHelpAbcExamples.filter(({ key }) =>
      ["rondo-alla-turca", "the-entertainer"].includes(key),
    );

    expect(completeScores).toHaveLength(2);
    for (const example of completeScores) {
      expect(example.source.length).toBeGreaterThan(5_000);
      expect(example.source).toContain("V:RH clef=treble");
      expect(example.source).toContain("V:LH clef=bass");
    }
  });

  it("stores every example as inert structured card content", () => {
    const cards = createFnfHelpLibraryDeckSeeds().flatMap((deck) => deck.cards);
    for (const card of cards) {
      expect(() => cardContentSchema.parse(card.front)).not.toThrow();
      expect(() => cardContentSchema.parse(card.back)).not.toThrow();
      expect(card.kind).toBe("QUESTION");
    }
  });

  it("keeps all authored help text and source descriptions in English", () => {
    const serialized = JSON.stringify(createFnfHelpLibraryDeckSeeds());
    for (const germanFragment of [
      "Punkte",
      "Quelltext",
      "Beschreibung",
      "Lernen",
      "Schwerpunkt",
      "verschieben",
    ]) {
      expect(serialized).not.toContain(germanFragment);
    }
  });
});
