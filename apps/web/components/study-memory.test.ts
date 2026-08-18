import { describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";

import {
  countMemoryTileFailures,
  memoryFailureLimit,
  memoryPairIdsForTileIds,
  memoryPairsFromCards,
  memorySelectionAfterTileClick,
  shuffledMemoryTiles,
} from "./study-memory";

const due = (id: string, front: string, back: string): DueCard =>
  ({
    card: {
      id,
      front: {
        blocks: [{ type: "markdown", revealMode: "ALL", source: front }],
      },
      back: {
        blocks: [{ type: "markdown", revealMode: "ALL", source: back }],
      },
    },
    lastRating: "GOOD",
    studyMode: "LEARNING",
  }) as DueCard;

describe("Memory round selection", () => {
  it("restarts with any clicked tile after two mismatched cards", () => {
    let selected = memorySelectionAfterTileClick([], "a:question");
    selected = memorySelectionAfterTileClick(selected, "b:question");
    expect(selected).toEqual(["a:question", "b:question"]);

    selected = memorySelectionAfterTileClick(selected, "c:question");
    selected = memorySelectionAfterTileClick(selected, "a:answer");
    expect(selected).toEqual(["c:question", "a:answer"]);

    selected = memorySelectionAfterTileClick(selected, "a:answer");
    expect(selected).toEqual(["a:answer"]);
    selected = memorySelectionAfterTileClick(selected, "b:question");
    expect(selected).toEqual(["a:answer", "b:question"]);
  });

  it("counts mistakes per physical tile instead of sharing them across a pair", () => {
    const firstAttempt = countMemoryTileFailures(
      {},
      ["a:question", "b:question"],
      2,
    );
    const secondAttempt = countMemoryTileFailures(
      firstAttempt.failures,
      ["c:question", "a:answer"],
      2,
    );

    expect(secondAttempt.failures).toEqual({
      "a:question": 1,
      "a:answer": 1,
      "b:question": 1,
      "c:question": 1,
    });
    expect(secondAttempt.newlyMarkedTileIds).toEqual([]);

    const thirdAttempt = countMemoryTileFailures(
      secondAttempt.failures,
      ["a:question", "b:answer"],
      2,
    );
    expect(thirdAttempt.newlyMarkedTileIds).toEqual(["a:question"]);
    expect(thirdAttempt.failures["a:answer"]).toBe(1);
    expect(
      memoryPairIdsForTileIds(
        [
          { id: "a:question", pairId: "a" },
          { id: "a:answer", pairId: "a" },
          { id: "b:answer", pairId: "b" },
        ],
        thirdAttempt.newlyMarkedTileIds,
      ),
    ).toEqual(["a"]);
  });

  it("adapts the reveal threshold to the number of pairs", () => {
    expect(memoryFailureLimit(4)).toBe(2);
    expect(memoryFailureLimit(6)).toBe(3);
    expect(memoryFailureLimit(8)).toBe(3);
    expect(memoryFailureLimit(10)).toBe(4);
    expect(memoryFailureLimit(12)).toBe(4);
  });

  it("excludes duplicate, identical, long and unselected pairs", () => {
    const cards = [
      due("one", "Eins", "One"),
      due("duplicate", "Noch eins", "One"),
      due("identical", "Gleich", "Gleich"),
      due("long", "L".repeat(181), "Kurz"),
      { ...due("easy", "Leicht", "Easy"), lastRating: "EASY" as const },
      due("two", "Zwei", "Two"),
    ];
    const pairs = memoryPairsFromCards(cards, ["GOOD"], 12);
    expect(
      pairs.map(({ id, questionText, answerText }) => ({
        id,
        questionText,
        answerText,
      })),
    ).toEqual([
      { id: "one", questionText: "Eins", answerText: "One" },
      { id: "two", questionText: "Zwei", answerText: "Two" },
    ]);
    expect(pairs[0]?.questionContent).toEqual(cards[0]?.card.front);
    expect(pairs[0]?.answerContent).toEqual(cards[0]?.card.back);
  });

  it("preserves wiki-flavoured structured content for the normal renderer", () => {
    const source = "^ Begriff ^ Wert ^\n| Eins | One |";
    const pair = memoryPairsFromCards(
      [due("wiki", source, "Aufgelöste Antwort")],
      ["GOOD"],
      4,
    )[0];
    expect(pair?.questionText).toBe("^ Begriff ^ Wert ^ | Eins | One |");
    expect(pair?.questionContent.blocks[0]).toMatchObject({ source });
    expect(shuffledMemoryTiles([pair!], "wiki-round")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pairId: "wiki",
          side: "question",
          content: pair?.questionContent,
        }),
      ]),
    );
  });

  it("builds two deterministic tiles per pair", () => {
    const pairs = memoryPairsFromCards(
      [due("one", "Eins", "One"), due("two", "Zwei", "Two")],
      ["GOOD"],
      4,
    );
    const first = shuffledMemoryTiles(pairs, "round-a");
    expect(first).toEqual(shuffledMemoryTiles(pairs, "round-a"));
    expect(first).toHaveLength(4);
    expect(new Set(first.map((tile) => tile.pairId))).toEqual(
      new Set(["one", "two"]),
    );
  });
});
