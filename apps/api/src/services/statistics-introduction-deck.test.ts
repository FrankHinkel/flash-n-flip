import { cardContentSchema } from "@flashcards/domain/content";
import { validateJsxGraphSource } from "@flashcards/domain/jsx-graph";
import {
  mermaidDiagramTypeFromSource,
  validateMermaidDiagramSource,
} from "@flashcards/domain/mermaid-diagram";
import { describe, expect, it } from "vitest";

import {
  createStatisticsIntroductionDeckSeeds,
  statisticsIntroductionCardCount,
  statisticsIntroductionTemplateKey,
} from "./statistics-introduction-deck.js";

const fencedSources = (source: string, language: "jsxgraph" | "mermaid") =>
  [...source.matchAll(new RegExp(`\`\`\`${language}[^\\n]*\\n([\\s\\S]*?)\`\`\``, "g"))].map(
    (match) => match[1]!.trim(),
  );

describe("statistics introduction curated deck", () => {
  it("contains twenty sequential German learning cards", () => {
    const [deck] = createStatisticsIntroductionDeckSeeds();
    expect(deck).toMatchObject({
      key: statisticsIntroductionTemplateKey,
      parentKey: null,
      locale: "de",
      contentLocales: ["de"],
      studyOrder: "SEQUENTIAL",
    });
    expect(statisticsIntroductionCardCount).toBe(20);
    expect(deck?.cards).toHaveLength(20);
    expect(new Set(deck?.cards.map(({ key }) => key)).size).toBe(20);
    expect(deck?.cards.every(({ usage }) => usage === "LEARNING")).toBe(true);
  });

  it("stores every card as valid structured rich content", () => {
    const [deck] = createStatisticsIntroductionDeckSeeds();
    const markdownSources: string[] = [];
    for (const entry of deck!.cards) {
      expect(() => cardContentSchema.parse(entry.front)).not.toThrow();
      expect(() => cardContentSchema.parse(entry.back)).not.toThrow();
      markdownSources.push(
        ...[...entry.front.blocks, ...entry.back.blocks]
          .filter((block) => block.type === "markdown")
          .map((block) => block.source),
      );
    }
    const renderedSource = markdownSources.join("\n");
    expect(renderedSource).toContain("\\frac");
    expect(renderedSource).toContain("\\sigma");
    expect(renderedSource).not.toMatch(/[\b\f\v]/u);
  });

  it("validates every bounded JSXGraph and Mermaid explanation", () => {
    const [deck] = createStatisticsIntroductionDeckSeeds();
    const markdownSources = deck!.cards.flatMap((entry) =>
      [...entry.front.blocks, ...entry.back.blocks]
        .filter((block) => block.type === "markdown")
        .map((block) => block.source),
    );
    const graphs = markdownSources.flatMap((source) =>
      fencedSources(source, "jsxgraph"),
    );
    const diagrams = markdownSources.flatMap((source) =>
      fencedSources(source, "mermaid"),
    );

    expect(graphs).toHaveLength(10);
    expect(diagrams).toHaveLength(5);
    for (const source of graphs) {
      expect(validateJsxGraphSource(source).objectCount).toBeGreaterThan(0);
    }
    for (const source of diagrams) {
      const type = mermaidDiagramTypeFromSource(source);
      expect(type).not.toBeNull();
      expect(() =>
        validateMermaidDiagramSource(source, type!),
      ).not.toThrow();
    }
  });

  it("does not embed executable or remote content", () => {
    const serialized = JSON.stringify(createStatisticsIntroductionDeckSeeds());
    expect(serialized).not.toMatch(
      /<script|<iframe|javascript:|https?:\/\/|onload=|onclick=/iu,
    );
  });
});
