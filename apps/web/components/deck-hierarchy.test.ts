import { describe, expect, it } from "vitest";

import type { DeckSummary } from "@flashcards/api-client";

import {
  buildDeckHierarchy,
  buildDeckAccordion,
  buildParentDeckHierarchy,
  deckHierarchyPrefix,
  directChildDecks,
  toggleDeckAccordionPath,
} from "./deck-hierarchy";

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
  archivedAt: null,
  visual: null,
  sourceTemplateKey: null,
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  cardCount: 1,
  reviewedCardCount: 0,
  storageBytes: 128,
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

  it("excludes the edited deck and all descendants from parent options", () => {
    const result = buildParentDeckHierarchy(
      [
        deck("world", "World"),
        deck("europe", "Europe", "world"),
        deck("france", "France", "europe"),
        deck("personal", "Personal"),
      ],
      "europe",
    );

    expect(
      result.map(({ deck: item, depth }) => `${depth}:${item.title}`),
    ).toEqual(["0:Personal", "0:World"]);
  });

  it("lists visible direct children as editor destinations", () => {
    const hidden = {
      ...deck("hidden", "Hidden", "world"),
      hiddenAt: "2026-01-02T00:00:00.000Z",
    };
    const archived = {
      ...deck("archived", "Archived", "world"),
      archivedAt: "2026-01-02T00:00:00.000Z",
    };

    expect(
      directChildDecks(
        [
          deck("world", "World"),
          deck("calculus", "Calculus", "world"),
          deck("basics", "Basics", "world"),
          deck("nested", "Nested", "basics"),
          hidden,
          archived,
        ],
        "world",
      ).map((item) => item.title),
    ).toEqual(["Basics", "Calculus"]);
  });

  it("shows roots first and keeps only one expanded path visible", () => {
    const decks = [
      deck("world", "World"),
      deck("africa", "Africa", "world"),
      deck("benin", "Benin", "africa"),
      deck("europe", "Europe", "world"),
      deck("france", "France", "europe"),
      deck("personal", "Personal"),
    ];

    expect(
      buildDeckAccordion(decks, []).map(({ deck: item }) => item.title),
    ).toEqual(["Personal", "World"]);
    expect(
      buildDeckAccordion(decks, ["world", "africa"]).map(
        ({ deck: item, depth }) => `${depth}:${item.title}`,
      ),
    ).toEqual(["0:Personal", "0:World", "1:Africa", "2:Benin", "1:Europe"]);
    expect(
      buildDeckAccordion(decks, ["world", "europe"]).map(
        ({ deck: item, depth }) => `${depth}:${item.title}`,
      ),
    ).toEqual(["0:Personal", "0:World", "1:Africa", "1:Europe", "2:France"]);
  });

  it("opens a row path and collapses it back to its parent", () => {
    const rows = buildDeckAccordion(
      [
        deck("world", "World"),
        deck("africa", "Africa", "world"),
        deck("benin", "Benin", "africa"),
      ],
      ["world"],
    );
    const africa = rows.find(({ deck: item }) => item.id === "africa")!;

    expect(toggleDeckAccordionPath(["world"], africa)).toEqual([
      "world",
      "africa",
    ]);
    expect(toggleDeckAccordionPath(["world", "africa"], africa)).toEqual([
      "world",
    ]);
  });
});
