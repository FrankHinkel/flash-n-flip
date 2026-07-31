import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  markdownToRichTextDocument,
  validateCardContent,
} from "@flashcards/domain/content";

import {
  createDeveloperReferenceDeckSeeds,
  developerReferenceCardCount,
  developerReferenceDefinitions,
  developerReferenceIds,
} from "./developer-reference-decks.js";

describe("developer reference collections", () => {
  const legacyIds = developerReferenceIds.slice(0, 10);
  const expandedIds = developerReferenceIds.slice(10);

  it("creates every developer collection with the introduction/advanced/sample structure", () => {
    expect(developerReferenceDefinitions.map((item) => item.id)).toEqual(
      developerReferenceIds,
    );

    for (const id of legacyIds) {
      const seeds = createDeveloperReferenceDeckSeeds(id);
      expect(seeds).toHaveLength(4);
      expect(seeds[0]).toMatchObject({ parentKey: null, cards: [] });
      expect(seeds.slice(1).map((seed) => seed.cards.length)).toEqual([
        12, 8, 10,
      ]);
      expect(seeds.slice(1).map((seed) => seed.title)).toEqual([
        expect.stringContaining("Introduction"),
        expect.stringContaining("Advanced"),
        expect.stringContaining("Practical Samples"),
      ]);
      expect(developerReferenceCardCount(id)).toBe(30);
      expect(
        seeds.slice(1).every((seed) => seed.parentKey === seeds[0]!.key),
      ).toBe(true);
    }

    for (const id of expandedIds) {
      const seeds = createDeveloperReferenceDeckSeeds(id);
      expect(seeds).toHaveLength(4);
      expect(seeds.slice(1).map((seed) => seed.cards.length)).toEqual([
        8, 6, 6,
      ]);
      expect(developerReferenceCardCount(id)).toBe(20);
      expect(
        seeds.slice(1).every((seed) => seed.parentKey === seeds[0]!.key),
      ).toBe(true);
    }
  });

  it("emits safe editable Markdown cards with copyable command examples", () => {
    const forbidden = /<script|<iframe|javascript:|data:text\/html|onerror=/i;

    for (const id of developerReferenceIds) {
      const cards = createDeveloperReferenceDeckSeeds(id).flatMap(
        (seed) => seed.cards,
      );
      for (const card of cards) {
        try {
          validateCardContent(card.front);
          validateCardContent(card.back);
        } catch (error) {
          throw new Error(
            `${id}/${card.key}: ${error instanceof Error ? error.message : error}`,
          );
        }
        expect(hasCardContent(card.front)).toBe(true);
        expect(hasCardContent(card.back)).toBe(true);

        const front = card.front.blocks[0]!;
        const back = card.back.blocks[0]!;
        expect(front.type).toBe("markdown");
        expect(back.type).toBe("markdown");
        if (front.type !== "markdown" || back.type !== "markdown") continue;

        expect(front.source).toContain("Open the answer");
        expect(back.source).toContain("### Command or pattern");
        expect(back.source).toContain("### Practical example");
        expect(back.source).toMatch(
          /```(?:bash|batch|dockerfile|json|powershell|regex|sql|text|xml|yaml)/,
        );
        expect(forbidden.test(back.source)).toBe(false);
        expect(markdownToRichTextDocument(back.source)).toBeDefined();
      }
    }
  });

  it("keeps practical samples explicit and ordered", () => {
    for (const id of developerReferenceIds) {
      const samples = createDeveloperReferenceDeckSeeds(id).find((seed) =>
        seed.key.endsWith(":samples"),
      )!;
      expect(samples.cards.length).toBeGreaterThanOrEqual(6);
      samples.cards.forEach((card, index) => {
        const front = card.front.blocks[0]!;
        expect(front.type).toBe("markdown");
        if (front.type === "markdown") {
          expect(front.source).toContain(`Sample ${index + 1}:`);
        }
      });
    }
  });

  it("pairs every XPath and JSONPath example with a compact source structure", () => {
    for (const [id, language] of [
      ["xpath", "XML"],
      ["jsonpath", "JSON"],
    ] as const) {
      const cards = createDeveloperReferenceDeckSeeds(id).flatMap(
        (seed) => seed.cards,
      );
      expect(cards).toHaveLength(30);
      for (const referenceCard of cards) {
        const back = referenceCard.back.blocks[0]!;
        expect(back.type).toBe("markdown");
        if (back.type !== "markdown") continue;
        expect(back.source).toContain(`### Example ${language}`);
        expect(back.source).toContain(`\`\`\`${language.toLowerCase()}`);
      }
    }
  });
});
