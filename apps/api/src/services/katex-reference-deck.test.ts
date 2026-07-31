import { describe, expect, it } from "vitest";

import {
  hasCardContent,
  markdownToRichTextDocument,
  validateCardContent,
} from "@flashcards/domain/content";

import {
  createKatexReferenceDeckSeeds,
  katexReferenceCardCount,
  katexReferenceDeckCount,
  katexReferenceTemplateKey,
} from "./katex-reference-deck.js";

describe("KaTeX developer reference collection", () => {
  it("creates one root collection and fifteen ordered reference decks", () => {
    const seeds = createKatexReferenceDeckSeeds();

    expect(seeds).toHaveLength(katexReferenceDeckCount + 1);
    expect(seeds[0]).toMatchObject({
      key: katexReferenceTemplateKey,
      parentKey: null,
      cards: [],
    });
    expect(
      seeds
        .slice(1)
        .every((seed) => seed.parentKey === katexReferenceTemplateKey),
    ).toBe(true);
    expect(seeds.slice(1).map((seed) => seed.title)).toEqual(
      expect.arrayContaining([
        "01 · Fundamentals and syntax",
        "13 · Commands and macros",
        "14 · Flash-n-Flip tables and clozes",
        "15 · Common errors and limitations",
      ]),
    );
    expect(seeds.flatMap((seed) => seed.cards)).toHaveLength(
      katexReferenceCardCount,
    );
    expect(katexReferenceCardCount).toBe(45);
  });

  it("emits editable reference cards with renderable explanations", () => {
    const cards = createKatexReferenceDeckSeeds().flatMap((seed) => seed.cards);

    for (const card of cards) {
      validateCardContent(card.front);
      validateCardContent(card.back);
      expect(hasCardContent(card.front)).toBe(true);
      expect(hasCardContent(card.back)).toBe(true);
      const frontBlock = card.front.blocks[0]!;
      expect(frontBlock.type).toBe("markdown");
      if (frontBlock.type === "markdown") {
        expect(frontBlock.source).toContain("Open the answer");
      }
      const block = card.back.blocks[0]!;
      expect(block.type).toBe("markdown");
      if (block.type !== "markdown") continue;
      const document = markdownToRichTextDocument(block.source);
      expect(JSON.stringify(document)).toContain('"type":"mathBlock"');
      expect(block.source).toContain("### Source");
      expect(block.source).toContain("### What it shows");
    }
  });

  it("keeps Flash-n-Flip cloze examples as copyable source code", () => {
    const integrationDeck = createKatexReferenceDeckSeeds().find(
      (seed) => seed.title === "14 · Flash-n-Flip tables and clozes",
    )!;
    const sources = integrationDeck.cards.map((card) => {
      const block = card.back.blocks[0]!;
      return block.type === "markdown" ? block.source : "";
    });

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.stringContaining("`{{$x^2$|$x^0$|$2x$}}`"),
        expect.stringContaining("`{{$P(A|B)$|$P(A\\cap B)$}}`"),
      ]),
    );
  });

  it("includes the delimiter syntax in inline and display source examples", () => {
    const fundamentals = createKatexReferenceDeckSeeds().find(
      (seed) => seed.title === "01 · Fundamentals and syntax",
    )!;
    const sourceByKey = new Map(
      fundamentals.cards.map((card) => {
        const block = card.back.blocks[0]!;
        return [card.key, block.type === "markdown" ? block.source : ""];
      }),
    );

    expect(sourceByKey.get("inline")).toContain("```latex\n$a^2+b^2=c^2$\n```");
    expect(sourceByKey.get("display")).toContain(
      "```latex\n$$\nx=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\n$$\n```",
    );
  });
});
