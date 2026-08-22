import { describe, expect, it } from "vitest";

import {
  mermaidDiagramBlockSchema,
  mermaidDiagramExamples,
  mermaidDiagramTypeFromSource,
  validateMermaidDiagramSource,
  type MermaidDiagramType,
} from "./mermaid-diagram";

describe("Mermaid diagram content", () => {
  it.each(Object.entries(mermaidDiagramExamples))(
    "accepts the bounded %s example",
    (diagramType, source) => {
      expect(
        mermaidDiagramBlockSchema.parse({
          type: "mermaidDiagram",
          version: 1,
          diagramType,
          source,
          label: `${diagramType} example`,
          description: "An accessible explanation of the example diagram.",
        }),
      ).toMatchObject({ diagramType, source });
      expect(
        validateMermaidDiagramSource(source, diagramType as MermaidDiagramType)
          .lineCount,
      ).toBeGreaterThan(1);
    },
  );

  it("detects the declared diagram type from the first content line", () => {
    expect(
      mermaidDiagramTypeFromSource("%% comment\nstateDiagram-v2\n  A --> B"),
    ).toBe("state");
    expect(mermaidDiagramTypeFromSource("pie\n  title Unsafe type")).toBeNull();
  });

  it.each([
    "flowchart LR\n  A --> B\n  click A callback",
    'flowchart LR\n  A --> B\n  click A "https://example.com"',
    "%%{init: {'theme': 'dark'}}%%\nflowchart LR\n  A --> B",
    "---\ntitle: injected\n---\nflowchart LR\n  A --> B",
    "flowchart LR\n  A[<script>alert(1)</script>] --> B",
    "flowchart LR\n  A --> B\n  classDef danger fill:red",
    "flowchart LR\n  A[image: https://example.com/a.png] --> B",
  ])("rejects unsafe Mermaid source: %s", (source) => {
    expect(() => validateMermaidDiagramSource(source, "flowchart")).toThrow();
  });

  it("rejects a mismatched declared type and bounded complexity violations", () => {
    expect(() =>
      validateMermaidDiagramSource(mermaidDiagramExamples.sequence, "class"),
    ).toThrow(/does not match/);
    expect(() =>
      validateMermaidDiagramSource(
        `flowchart LR\n${Array.from(
          { length: 301 },
          (_, index) => `  N${index} --> N${index + 1}`,
        ).join("\n")}`,
        "flowchart",
      ),
    ).toThrow(/exceeds/);
    expect(() =>
      validateMermaidDiagramSource(
        `flowchart LR\n  A[${"x".repeat(1001)}]`,
        "flowchart",
      ),
    ).toThrow(/oversized line/);
  });

  it("requires explicit accessible text", () => {
    expect(
      mermaidDiagramBlockSchema.safeParse({
        type: "mermaidDiagram",
        version: 1,
        diagramType: "flowchart",
        source: mermaidDiagramExamples.flowchart,
        label: "",
        description: "",
      }).success,
    ).toBe(false);
  });
});
