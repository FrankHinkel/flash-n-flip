import { describe, expect, it } from "vitest";

import type { DeckSummary } from "@flashcards/api-client";

import { buildDeckHierarchy, deckHierarchyPrefix } from "./deck-hierarchy";

const deck = (
  id: string,
  title: string,
  parentDeckId: string | null = null,
): DeckSummary => ({
  id,
  parentDeckId,
  title,
  description: "",
  language: "en",
  contentLocales: ["en"],
  defaultContentLocale: "en",
  protectionMode: "STANDARD",
  tags: [],
  favorite: false,
  hiddenAt: null,
  visual: null,
  sourceTemplateKey: null,
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  cardCount: 1,
});

describe("deck hierarchy", () => {
  it("orders roots and descendants alphabetically in depth-first order", () => {
    const result = buildDeckHierarchy([
      deck("france", "France", "europe"),
      deck("asia", "Asia", "world"),
      deck("world", "World"),
      deck("europe", "Europe", "world"),
      deck("personal", "Personal"),
    ]);

    expect(
      result.map(({ deck: item, depth }) => `${depth}:${item.title}`),
    ).toEqual(["0:Personal", "0:World", "1:Asia", "1:Europe", "2:France"]);
  });

  it("shows orphaned and cyclic decks exactly once", () => {
    const result = buildDeckHierarchy([
      deck("orphan", "Orphan", "missing"),
      deck("alpha", "Alpha", "beta"),
      deck("beta", "Beta", "alpha"),
    ]);

    expect(result.map(({ deck: item }) => item.title)).toEqual([
      "Orphan",
      "Alpha",
      "Beta",
    ]);
    expect(result.map(({ depth }) => depth)).toEqual([0, 0, 1]);
  });

  it("uses protected spaces for visible indentation", () => {
    expect(deckHierarchyPrefix(0)).toBe("");
    expect(deckHierarchyPrefix(1)).toBe("\u00a0\u00a0↳ ");
    expect(deckHierarchyPrefix(2)).toBe("\u00a0\u00a0\u00a0\u00a0↳ ");
  });
});
