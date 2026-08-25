import { describe, expect, it } from "vitest";

import {
  mermaidDiagramFromMarkdownSource,
  parseMermaidDiagramPresentation,
} from "./mermaid-markdown";

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

  it("parses bounded short display options including alpha colors", () => {
    expect(
      parseMermaidDiagramPresentation("{w=90% h=500px bg=#18212fff}"),
    ).toEqual({
      sizePercent: 100,
      width: { value: 90, unit: "percent" },
      height: { value: 500, unit: "px" },
      background: "#18212fff",
    });
    expect(parseMermaidDiagramPresentation("{bg=#235f}")).toEqual({
      sizePercent: 100,
      width: { value: 100, unit: "percent" },
      height: { value: 50, unit: "viewportHeight" },
      background: "#235f",
    });
    expect(parseMermaidDiagramPresentation(undefined)).toEqual({
      sizePercent: 100,
      width: { value: 100, unit: "percent" },
      height: { value: 50, unit: "viewportHeight" },
      background: "auto",
    });
    expect(parseMermaidDiagramPresentation("{h=70%}")).toEqual({
      sizePercent: 100,
      width: { value: 100, unit: "percent" },
      height: { value: 70, unit: "percent" },
      background: "auto",
    });
    expect(
      parseMermaidDiagramPresentation("{size=80 w=65vw h=40vh bg=transparent}"),
    ).toEqual({
      sizePercent: 80,
      width: { value: 65, unit: "viewportWidth" },
      height: { value: 40, unit: "viewportHeight" },
      background: "transparent",
    });
    expect(
      parseMermaidDiagramPresentation("{size=125% w=80vh h=80vh bg=auto}"),
    ).toEqual({
      sizePercent: 125,
      width: { value: 80, unit: "viewportHeight" },
      height: { value: 80, unit: "viewportHeight" },
      background: "auto",
    });
  });

  it("rejects arbitrary CSS, unknown options, and out-of-range sizes", () => {
    for (const value of [
      "{w=101%}",
      "{w=101vw}",
      "{h=5000px}",
      "{h=101%}",
      "{h=101vh}",
      "{bg=url(https://example.org/x)}",
      "{style=position:fixed}",
      "{w=90% w=80%}",
    ]) {
      expect(parseMermaidDiagramPresentation(value)).toBeNull();
    }
  });
});
