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

  it("parses GFM tables without treating cloze choices as columns", () => {
    const source = [
      "| Person | Verb | Hinweis |",
      "| :--- | :---: | ---: |",
      "| ich | {{1:gehe|gehst|geht}} | links \\| rechts |",
      "| du | {{2:gehst|gehe|geht}} | $P(A|B)$ |",
    ].join("\n");
    const document = markdownToRichTextDocument(source);
    const table = document.content[0];

    expect(table?.type).toBe("table");
    expect(table?.attrs?.align).toEqual(["left", "center", "right"]);
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[1]?.content).toHaveLength(3);
    expect(
      table?.content?.[1]?.content?.[1]?.content?.find(
        (node) => node.type === "cloze",
      )?.attrs,
    ).toMatchObject({
      answer: "gehe",
      choices: ["gehe", "gehst", "geht"],
    });
    expect(table?.content?.[1]?.content?.[2]?.content?.[0]?.text).toBe(
      "links | rechts",
    );
    expect(table?.content?.[2]?.content?.[2]?.content?.[0]).toMatchObject({
      type: "mathInline",
      attrs: { latex: "P(A|B)" },
    });

    const roundTrip = richTextDocumentToMarkdown(document);
    expect(roundTrip).toContain("{{1:gehe|gehst|geht}}");
    expect(roundTrip).toContain("links \\| rechts");
    expect(markdownToRichTextDocument(roundTrip)).toEqual(document);
  });

  it("parses inline and display math alongside GFM task lists", () => {
    const document = markdownToRichTextDocument(
      [
        "Die Fläche ist $A = \\pi r^2$.",
        "",
        "$$",
        "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
        "$$",
        "",
        "- [x] Formel erkannt",
        "- [ ] Noch üben",
      ].join("\n"),
    );
    const json = JSON.stringify(document);

    expect(json).toContain('"type":"mathInline"');
    expect(json).toContain('"type":"mathBlock"');
    expect(json).toContain('"checked":true');
    expect(json).toContain('"checked":false');
    expect(
      markdownToRichTextDocument(richTextDocumentToMarkdown(document)),
    ).toEqual(document);
  });

  it("does not interpret LaTeX grouping braces as clozes", () => {
    const source = [
      "Inline: $\\\\frac{{a}}{{b}}$",
      "",
      "$$",
      "\\\\frac{{x + 1}}{{y - 1}}",
      "$$",
      "",
      "Lücke: {{richtig|falsch}}",
    ].join("\n");

    expect(parseMarkdownClozes(source)).toHaveLength(1);
    const document = markdownToRichTextDocument(source);
    expect(JSON.stringify(document)).toContain("\\\\frac{{a}}{{b}}");
    expect(JSON.stringify(document)).toContain("\\\\frac{{x + 1}}{{y - 1}}");
  });

  it("rejects raw HTML and external Markdown images", () => {
    expect(() => markdownToRichTextDocument("<b>nicht erlaubt</b>")).toThrow(
      /raw html/i,
    );
    expect(() =>
      markdownToRichTextDocument("![Tracking](https://example.org/pixel.gif)"),
    ).toThrow(/images are not allowed/i);
  });
});
