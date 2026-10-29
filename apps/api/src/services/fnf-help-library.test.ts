import { readFileSync } from "node:fs";

import {
  cardContentSchema,
  markdownToRichTextDocument,
} from "@flashcards/domain/content";
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
  fnfHelpThirdPartyTemplateKey,
} from "./fnf-help-library.js";
import {
  thirdPartyNoticeComponentCount,
  thirdPartyNoticeGraphSha256,
  thirdPartyNoticePages,
} from "./third-party-notices.generated.js";

describe("Flash-n-Flip Help reference library", () => {
  it("contains a stable root, format references, and nested legal notices", () => {
    const decks = createFnfHelpLibraryDeckSeeds();
    expect(decks[0]).toMatchObject({
      key: fnfHelpLibraryTemplateKey,
      parentKey: null,
    });
    expect(decks.slice(1)).toHaveLength(5);
    expect(decks.map((deck) => deck.title)).toEqual([
      "Flash-n-Flip Help",
      expect.stringContaining("JSXGraph"),
      expect.stringContaining("Mermaid"),
      expect.stringContaining("ABC"),
      "Legal & Product Information",
      "Third-Party Licenses",
    ]);
    expect(fnfHelpLibraryExampleCount).toBeGreaterThanOrEqual(50);
    expect(fnfHelpLibraryCardCount).toBeGreaterThan(fnfHelpLibraryExampleCount);
    for (const deck of decks.slice(1, 4)) {
      expect(deck.cards[0]?.key).toBe("intro-welcome");
      expect(deck.cards[1]?.key).toBe("intro-structure");
    }
    expect(decks.at(-1)).toMatchObject({
      key: fnfHelpThirdPartyTemplateKey,
      parentKey: expect.stringContaining(":legal"),
    });
  });

  it("contains deterministic offline production-component notices", () => {
    expect(thirdPartyNoticeComponentCount).toBeGreaterThan(100);
    expect(thirdPartyNoticeComponentCount).toBeLessThan(200);
    expect(thirdPartyNoticeGraphSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(thirdPartyNoticePages).toHaveLength(1);
    expect(thirdPartyNoticePages[0]?.source).not.toContain(
      "Dependency graph SHA-256",
    );
    expect(thirdPartyNoticePages[0]?.source).not.toContain("App version:");
    expect(thirdPartyNoticePages[0]?.source).toContain(
      "[Open complete offline notices](/legal/documents/third-party-notices.html)",
    );

    const offlineDocument = readFileSync(
      new URL(
        "../../../web/public/legal/documents/third-party-notices.html",
        import.meta.url,
      ),
      "utf8",
    );
    expect(offlineDocument).toContain("FreePats Upright Piano KW");
    expect(offlineDocument).toContain("jsxgraph</a>");
    expect(offlineDocument).toContain("jszip</a>");
    expect(offlineDocument).toContain("Permission is hereby granted");
    expect(offlineDocument).toContain("https://spdx.org/licenses/MIT.html");
    expect(offlineDocument).toContain("script-src 'none'");
    expect(offlineDocument).not.toContain("<script");
    expect(offlineDocument).not.toContain("LGPL-3.0-or-later");
    expect(offlineDocument).not.toContain("GPL-3.0-or-later");
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

  it("keeps the ten compact ABC examples without the two complete piano scores", () => {
    expect(fnfHelpAbcExamples).toHaveLength(10);
    const abcDeck = createFnfHelpLibraryDeckSeeds().find(
      ({ key }) => key === `${fnfHelpLibraryTemplateKey}:abc`,
    );
    expect(abcDeck?.cards).toHaveLength(13);
    expect(abcDeck?.cards.map(({ key }) => key)).not.toContain(
      "rondo-alla-turca",
    );
    expect(abcDeck?.cards.map(({ key }) => key)).not.toContain(
      "the-entertainer",
    );
    expect(abcDeck?.cards.at(-1)?.key).toBe("four-voice-harmony");
  });

  it("stores every example as inert structured card content", () => {
    const cards = createFnfHelpLibraryDeckSeeds().flatMap((deck) => deck.cards);
    for (const card of cards) {
      expect(() => cardContentSchema.parse(card.front)).not.toThrow();
      expect(() => cardContentSchema.parse(card.back)).not.toThrow();
      expect(card.kind).toBe("QUESTION");
      expect(card.usage).toBe("REFERENCE");
    }
  });

  it.each([
    ["abc", fnfHelpAbcExamples],
    ["mermaid", fnfHelpMermaidExamples],
    ["jsxgraph", fnfHelpJsxGraphExamples],
  ] as const)(
    "provides complete, directly reusable %s Markdown in every copy block",
    (language, examples) => {
      const deck = createFnfHelpLibraryDeckSeeds().find(
        ({ key }) => key === `${fnfHelpLibraryTemplateKey}:${language}`,
      )!;
      for (const example of examples) {
        const card = deck.cards.find(({ key }) => key === example.key)!;
        const block = card.back.blocks[0]!;
        if (block.type !== "markdown")
          throw new Error("Expected Markdown reference");
        const nodes = markdownToRichTextDocument(block.source).content;
        const preview = nodes.find(
          (node) =>
            node.type === "codeBlock" && node.attrs?.language === language,
        )!;
        const copy = nodes.find(
          (node) =>
            node.type === "codeBlock" && node.attrs?.language === "text",
        )!;
        const copiedText = copy.content
          ?.map((node) => node.text ?? "")
          .join("");
        const opening =
          language === "abc"
            ? "```abc{size=70% bars=auto keyboard=notes}"
            : `\`\`\`${language}{w=fill h=50vh}`;
        expect(copiedText).toBe([opening, example.source, "```"].join("\n"));
        const pasted = markdownToRichTextDocument(copiedText!).content;
        expect(pasted).toHaveLength(1);
        expect(pasted[0]).toEqual(preview);
      }
    },
  );

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
