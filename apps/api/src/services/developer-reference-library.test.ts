import { describe, expect, it } from "vitest";

import {
  createDeveloperReferenceLibraryDeckSeeds,
  developerReferenceLibraryCardCount,
  developerReferenceLibraryCategoryCount,
  developerReferenceLibraryDeckCount,
  developerReferenceLibraryTechnologyCount,
  developerReferenceLibraryTemplateKey,
} from "./developer-reference-library.js";

describe("developer reference library", () => {
  it("combines every reference below one categorized root", () => {
    const seeds = createDeveloperReferenceLibraryDeckSeeds();
    const keys = new Set(seeds.map((seed) => seed.key));
    const root = seeds[0]!;

    expect(root).toMatchObject({
      key: developerReferenceLibraryTemplateKey,
      parentKey: null,
      cards: [],
    });
    expect(keys.size).toBe(seeds.length);
    expect(developerReferenceLibraryCategoryCount).toBe(8);
    expect(developerReferenceLibraryTechnologyCount).toBe(21);
    expect(developerReferenceLibraryDeckCount).toBe(seeds.length - 1);
    expect(developerReferenceLibraryCardCount).toBe(545);
    expect(
      seeds
        .slice(1)
        .every((seed) => seed.parentKey && keys.has(seed.parentKey)),
    ).toBe(true);
  });

  it("retains the existing technology template keys and card namespaces", () => {
    const seeds = createDeveloperReferenceLibraryDeckSeeds();
    expect(seeds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "developer:git-reference:v1",
          cardNamespace: "git",
        }),
        expect.objectContaining({
          key: "developer:katex-reference:v1",
          cardNamespace: "katex",
        }),
      ]),
    );
  });

  it("adds prerequisite and step-by-step guidance to all 545 cards", () => {
    const cards = createDeveloperReferenceLibraryDeckSeeds().flatMap(
      (seed) => seed.cards,
    );
    expect(cards).toHaveLength(545);

    for (const card of cards) {
      const back = card.back.blocks[0]!;
      expect(back.type).toBe("markdown");
      if (back.type !== "markdown") continue;
      expect(back.source).toContain("### Syntax, step by step");
      expect(back.source).toMatch(/### (Before you start|Builds on)/);
    }
  });
});
