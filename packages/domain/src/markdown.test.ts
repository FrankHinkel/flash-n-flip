import { describe, expect, it } from "vitest";

import {
  markdownToRichTextDocument,
  migrateGfmTablesToWikiTables,
  parseMarkdownClozes,
  repairDuplicateMarkdownClozePositions,
  resolveMarkdownClozeRevealMode,
  richTextDocumentToMarkdown,
} from "./markdown.js";

describe("restricted Markdown", () => {
  it("round-trips named content-style marks through the card editor", () => {
    const document = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph" as const,
          content: [
            {
              type: "text" as const,
              text: "styled",
              marks: [
                { type: "contentStyle" as const, attrs: { name: "accent" } },
              ],
            },
          ],
        },
      ],
    };
    const markdown = richTextDocumentToMarkdown(document);

    expect(markdown).toContain("flashnflip:content-style/accent");
    expect(markdownToRichTextDocument(markdown)).toEqual(document);
  });
  it("parses explicit and implicit cloze order with same-card mixing", () => {
    const clozes = parseMarkdownClozes(
      "{{2:geht|ging}}\n{{bin|+2}}\n{{1:habe}}\n{{ist|sind|+4}}",
    );
    expect(clozes.map(({ order }) => order)).toEqual([2, 3, 1, 4]);
    expect(clozes[1]?.choices).toEqual(["bin", "geht", "habe"]);
    expect(clozes[3]?.choices).toEqual(["ist", "sind", "geht", "bin", "habe"]);
  });

  it("automatically reveals explicitly positioned clozes sequentially", () => {
    expect(
      resolveMarkdownClozeRevealMode("{{1:first}} {{2:second}}", "AUTO"),
    ).toBe("SEQUENTIAL");
    expect(resolveMarkdownClozeRevealMode("{{first}} {{second}}", "AUTO")).toBe(
      "ALL",
    );
    expect(
      resolveMarkdownClozeRevealMode(
        "`{{1:code}}`\n```\n{{2:fenced}}\n```\n{{plain}}",
        "AUTO",
      ),
    ).toBe("ALL");
    expect(resolveMarkdownClozeRevealMode("{{1:first}}", "ALL")).toBe("ALL");
    expect(resolveMarkdownClozeRevealMode("{{first}}", "SEQUENTIAL")).toBe(
      "SEQUENTIAL",
    );
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

  it("preserves spaced and compact fenced-code display metadata", () => {
    for (const source of [
      "```mermaid {w=90% h=500px bg=#18212fff}\nflowchart LR\n  A --> B\n```",
      "```mermaid{w=90% h=500px bg=#235f}\nflowchart LR\n  A --> B\n```",
    ]) {
      const document = markdownToRichTextDocument(source);
      expect(document.content[0]).toMatchObject({
        type: "codeBlock",
        attrs: {
          language: "mermaid",
          meta: expect.stringContaining("w=90%"),
        },
      });
      expect(
        markdownToRichTextDocument(richTextDocumentToMarkdown(document)),
      ).toEqual(document);
    }
  });

  it("splits long fenced music into schema-safe text nodes without changing it", () => {
    const notation = "CDEF|".repeat(5_001);
    const source = `\`\`\`music\n${notation}\n\`\`\``;
    const document = markdownToRichTextDocument(source);
    const codeBlock = document.content[0];

    expect(codeBlock).toMatchObject({
      type: "codeBlock",
      attrs: { language: "music" },
    });
    expect(codeBlock?.content?.length).toBe(3);
    expect(
      codeBlock?.content?.every(
        (node) => node.type === "text" && (node.text?.length ?? 0) <= 10_000,
      ),
    ).toBe(true);
    expect(richTextDocumentToMarkdown(document)).toBe(source);
  });

  it("parses and round-trips inline KaTeX inside cloze choices", () => {
    const source = [
      "| Term | Auswahl |",
      "| Ergebnis | {{$x^2$|$x^0$}} |",
      "| Bruch | {{$\\\\frac{a}{b}$|$P(A|B)$}} |",
    ].join("\n");
    const clozes = parseMarkdownClozes(source);

    expect(clozes).toHaveLength(2);
    expect(clozes[0]).toMatchObject({
      answer: "$x^2$",
      choices: ["$x^2$", "$x^0$"],
    });
    expect(clozes[1]).toMatchObject({
      answer: "$\\\\frac{a}{b}$",
      choices: ["$\\\\frac{a}{b}$", "$P(A|B)$"],
    });

    const document = markdownToRichTextDocument(source);
    const roundTrip = richTextDocumentToMarkdown(document);
    expect(roundTrip).toContain("{{1:$x^2$|$x^0$}}");
    expect(roundTrip).toContain("{{2:$\\\\frac{a}{b}$|$P(A|B)$}}");
    expect(markdownToRichTextDocument(roundTrip)).toEqual(document);
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
    expect(table?.attrs?.align).toEqual([]);
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

  it("parses resilient wiki tables with section headings and cell alignment", () => {
    const source = [
      "## Konjugiere",
      "",
      "^ Singular ^^",
      "|ich        |{{gehe|+3}}|",
      "|     du| {{gehst|+3}} |",
      "|   er/sie/es   |{{geht|+3}}|",
      "^ Plural ^^",
      "|wir|{{gehen|+3}}|",
      "|ihr|{{geht|+3}}|",
      "|sie/Sie|{{gehen|+3}}|",
    ].join("\n");
    const document = markdownToRichTextDocument(source);
    const table = document.content[1]!;

    expect(table.type).toBe("table");
    expect(table.content).toHaveLength(8);
    expect(table.content?.[0]?.content).toHaveLength(1);
    expect(table.content?.[0]?.content?.[0]?.attrs).toMatchObject({
      header: true,
      align: "center",
      colspan: 2,
    });
    expect(table.content?.[1]?.content?.[0]?.attrs?.align).toBe("left");
    expect(table.content?.[2]?.content?.[0]?.attrs?.align).toBe("right");
    expect(table.content?.[3]?.content?.[0]?.attrs?.align).toBe("center");
    expect(
      table.content?.[1]?.content?.[1]?.content?.find(
        (node) => node.type === "cloze",
      )?.attrs,
    ).toMatchObject({ answer: "gehe" });

    const roundTrip = richTextDocumentToMarkdown(document);
    expect(roundTrip).toContain("^ Singular ^^");
    expect(roundTrip).not.toContain("| ---");
    expect(markdownToRichTextDocument(roundTrip)).toEqual(document);
  });

  it("supports safe DokuWiki-style inline formatting inside wiki table cells", () => {
    const source = [
      "^ Format ^ Ergebnis ^",
      "| Fett | **wichtig** |",
      "| Kursiv | //achtsam// |",
      "| Unterstrichen | __zentral__ |",
      "| Code | ''a | b'' |",
      "| Link | https://flash-n-flip.com/help |",
      "| Formel | $\\\\frac{a}{b}$ |",
    ].join("\n");
    const document = markdownToRichTextDocument(source);
    const table = document.content[0]!;

    expect(table.type).toBe("table");
    expect(
      table.content?.[2]?.content?.[1]?.content?.[0]?.marks,
    ).toContainEqual({
      type: "italic",
    });
    expect(
      table.content?.[3]?.content?.[1]?.content?.[0]?.marks,
    ).toContainEqual({
      type: "underline",
    });
    expect(table.content?.[4]?.content?.[1]?.content?.[0]).toMatchObject({
      text: "a | b",
      marks: [{ type: "code" }],
    });
    expect(table.content?.[5]?.content?.[1]?.content?.[0]).toMatchObject({
      text: "https://flash-n-flip.com/help",
      marks: [{ type: "link" }],
    });
    expect(table.content?.[6]?.content?.[1]?.content?.[0]).toMatchObject({
      type: "mathInline",
      attrs: { latex: "\\\\frac{a}{b}" },
    });

    const roundTrip = richTextDocumentToMarkdown(document);
    expect(roundTrip).toContain("//achtsam//");
    expect(roundTrip).toContain("__zentral__");
    expect(roundTrip).toContain("''a | b''");
    expect(roundTrip).not.toContain("flashnflip:wiki-underline");
    expect(markdownToRichTextDocument(roundTrip)).toEqual(document);
  });

  it("uses ::: to continue side headings vertically", () => {
    const source = [
      "^ Singular |ich |{{1:bin|bist}}|",
      "| ::: |du |{{2:bist|bin}}|",
      "| ::: |er/sie/es |{{3:ist|sind}}|",
      "^ Plural |wir |{{4:sind|seid}}|",
      "| ::: |ihr |{{5:seid|sind}}|",
      "| ::: |sie/Sie |{{6:sind|seid}}|",
    ].join("\n");
    const document = markdownToRichTextDocument(source);
    const table = document.content[0]!;

    expect(table.type).toBe("table");
    expect(table.content?.[0]?.content?.[0]?.attrs).toMatchObject({
      header: true,
      colspan: 1,
      rowspan: 3,
    });
    expect(table.content?.[1]?.content).toHaveLength(2);
    expect(table.content?.[3]?.content?.[0]?.attrs).toMatchObject({
      header: true,
      rowspan: 3,
    });

    const roundTrip = richTextDocumentToMarkdown(document);
    expect(roundTrip).toContain("^ Singular |ich ");
    expect(roundTrip.match(/\| ::: \|/g)).toHaveLength(4);
    expect(markdownToRichTextDocument(roundTrip)).toEqual(document);
  });

  it("rejects ::: without a matching cell directly above", () => {
    expect(() => markdownToRichTextDocument("| ::: |orphaned|")).toThrow(
      /directly above/i,
    );
    expect(() =>
      markdownToRichTextDocument("^ Heading ^^|\n| ::: |value|"),
    ).toThrow(/same column span/i);
  });

  it("migrates GFM tables without rewriting surrounding Markdown or code", () => {
    const source = [
      "## Formen",
      "",
      "| Person | Verb |",
      "| :--- | ---: |",
      "| ich | {{gehe|gehst}} |",
      "",
      "```md",
      "| keep | this |",
      "| --- | --- |",
      "```",
    ].join("\n");
    const migrated = migrateGfmTablesToWikiTables(source);

    expect(migrated.changed).toBe(true);
    expect(migrated.source).toContain("^Person ^ Verb^");
    expect(migrated.source).toContain("|ich | {{gehe|gehst}}|");
    expect(migrated.source).toContain(
      "```md\n| keep | this |\n| --- | --- |\n```",
    );
    expect(migrateGfmTablesToWikiTables(migrated.source)).toEqual({
      source: migrated.source,
      changed: false,
    });
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
    expect(() =>
      markdownToRichTextDocument(
        "^ Unsafe ^^\n|<img src=x onerror=alert(1)>|value|",
      ),
    ).toThrow(/raw html/i);
    expect(() =>
      markdownToRichTextDocument(
        "^ Unsafe ^^\n|![Tracking](https://example.org/pixel.gif)|value|",
      ),
    ).toThrow(/images are not allowed/i);
  });
});
