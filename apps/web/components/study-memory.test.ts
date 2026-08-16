import { describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";

import {
  memoryFailureLimit,
  memoryPairsFromCards,
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
    expect(memoryPairsFromCards(cards, ["GOOD"], 12)).toEqual([
      { id: "one", question: "Eins", answer: "One" },
      { id: "two", question: "Zwei", answer: "Two" },
    ]);
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
