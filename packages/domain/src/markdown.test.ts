import { describe, expect, it } from "vitest";

import {
  markdownToRichTextDocument,
  parseMarkdownClozes,
  repairDuplicateMarkdownClozePositions,
  richTextDocumentToMarkdown,
} from "./markdown.js";

describe("restricted Markdown", () => {
  it("parses explicit and implicit cloze order with same-card mixing", () => {
    const clozes = parseMarkdownClozes(
      "{{2:geht|ging}}\n{{bin|+2}}\n{{1:habe}}\n{{ist|sind|+4}}",
    );
    expect(clozes.map(({ order }) => order)).toEqual([2, 3, 1, 4]);
    expect(clozes[1]?.choices).toEqual(["bin", "geht", "habe"]);
    expect(clozes[3]?.choices).toEqual(["ist", "sind", "geht", "bin", "habe"]);
  });

  it("keeps single-answer clozes as click-to-reveal and ignores code", () => {
    const source = "{{hund}}\n\n`{{katze}}`\n\n```\n{{maus}}\n```";
    expect(parseMarkdownClozes(source)).toEqual([
      {
        id: "cloze-1",
        order: 1,
        answer: "hund",
        choices: ["hund"],
        mixCount: 0,
        source: "{{hund}}",
      },
    ]);
    const document = markdownToRichTextDocument(source);
    expect(JSON.stringify(document)).toContain('"type":"cloze"');
    expect(JSON.stringify(document)).toContain("{{katze}}");
    expect(JSON.stringify(document)).toContain("{{maus}}");
  });

  it("rejects duplicate explicit positions and unsafe links render as text", () => {
    expect(() => parseMarkdownClozes("{{1:a}}\n{{1:b}}")).toThrow(/unique/i);
    const document = markdownToRichTextDocument(
      "[safe](https://flash-n-flip.com) [bad](javascript:alert(1))",
    );
    const json = JSON.stringify(document);
    expect(json).toContain('"type":"link"');
    expect(json).not.toContain("javascript:");
  });

  it("repairs duplicate and invalid explicit positions deterministically", () => {
    const source =
      "{{1:a}}\n{{2:b}}\n{{1:c}}\n{{0:d}}\n`{{1:code}}`\n```\n{{1:fenced}}\n```";
    const repaired = repairDuplicateMarkdownClozePositions(source);
    expect(repaired).toEqual({
      changed: true,
      source:
        "{{1:a}}\n{{2:b}}\n{{3:c}}\n{{4:d}}\n`{{1:code}}`\n```\n{{1:fenced}}\n```",
    });
    expect(repairDuplicateMarkdownClozePositions(repaired.source)).toEqual({
      changed: false,
      source: repaired.source,
    });
    expect(() => markdownToRichTextDocument(repaired.source)).not.toThrow();
  });

  it("round-trips the supported legacy document into Markdown", () => {
    const document = markdownToRichTextDocument(
      "## Titel\n\n1. Eins\n2. Zwei\n\nWir {{1:sind|seid}} hier.",
    );
    expect(richTextDocumentToMarkdown(document)).toBe(
      "## Titel\n\n1. Eins\n2. Zwei\n\nWir {{1:sind|seid}} hier.",
    );
  });
});
