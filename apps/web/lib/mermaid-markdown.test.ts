import { describe, expect, it } from "vitest";

import { mermaidDiagramFromMarkdownSource } from "./mermaid-markdown";

describe("mermaidDiagramFromMarkdownSource", () => {
  it("creates a render-only block without changing the Markdown source", () => {
    const source = "flowchart LR\n  A --> B";
    const result = mermaidDiagramFromMarkdownSource(source, "de");

    expect(source).toBe("flowchart LR\n  A --> B");
    expect(result).toEqual(
      expect.objectContaining({
        type: "mermaidDiagram",
        diagramType: "flowchart",
        source,
        label: "Flussdiagramm",
      }),
    );
  });

  it("accepts all four documented diagram examples", () => {
    const sources = [
      "flowchart LR\n  A --> B",
      "sequenceDiagram\n  A->>B: Hallo",
      "stateDiagram-v2\n  [*] --> Neu",
      "mindmap\n  root((Lernen))\n    Biologie",
    ];
    expect(
      sources.map(
        (source) => mermaidDiagramFromMarkdownSource(source, "de")?.diagramType,
      ),
    ).toEqual(["flowchart", "sequence", "state", "mindmap"]);
  });

  it("rejects empty, unsafe, and invalid sources", () => {
    const values = [
      "",
      "flowchart LR\n  A --> B\n  click A callback",
      "sequenceDiagram\n  A->>B: [Hallo",
    ];

    for (const markdown of values) {
      expect(mermaidDiagramFromMarkdownSource(markdown, "de")).toBeNull();
    }
  });
});
