import { describe, expect, it } from "vitest";

import { extractSafeMermaidFences } from "./mermaid-markdown";

describe("extractSafeMermaidFences", () => {
  it("converts a complete safe Mermaid fence into a structured block", () => {
    const result = extractSafeMermaidFences(
      "Frage\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nDanach",
      "de",
    );

    expect(result.markdown).toBe("Frage\n\nDanach");
    expect(result.diagrams).toEqual([
      expect.objectContaining({
        type: "mermaidDiagram",
        diagramType: "flowchart",
        source: "flowchart LR\n  A --> B",
        label: "Flussdiagramm",
      }),
    ]);
  });

  it("converts all four documented diagram examples", () => {
    const sources = [
      "flowchart LR\n  A --> B",
      "sequenceDiagram\n  A->>B: Hallo",
      "stateDiagram-v2\n  [*] --> Neu",
      "mindmap\n  root((Lernen))\n    Biologie",
    ];
    const result = extractSafeMermaidFences(
      sources.map((source) => `\`\`\`mermaid\n${source}\n\`\`\``).join("\n\n"),
      "de",
    );

    expect(result.markdown).toBe("");
    expect(result.diagrams.map(({ diagramType }) => diagramType)).toEqual([
      "flowchart",
      "sequence",
      "state",
      "mindmap",
    ]);
  });

  it("leaves incomplete, unsafe, and invalid fences as inert Markdown", () => {
    const values = [
      "```mermaid\nflowchart LR\n  A --> B",
      "```mermaid\nflowchart LR\n  A --> B\n  click A callback\n```",
      "```mermaid\nsequenceDiagram\n  A->>B: [Hallo\n```",
    ];

    for (const markdown of values) {
      expect(extractSafeMermaidFences(markdown, "de")).toEqual({
        markdown,
        diagrams: [],
      });
    }
  });

  it("does not normalize ordinary Markdown while the user is typing", () => {
    const markdown = "  Frage mit Leerraum\n\n";
    expect(extractSafeMermaidFences(markdown, "de")).toEqual({
      markdown,
      diagrams: [],
    });
  });
});
