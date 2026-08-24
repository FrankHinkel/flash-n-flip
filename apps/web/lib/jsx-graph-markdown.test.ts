import { describe, expect, it } from "vitest";

import { jsxGraphExamples } from "@flashcards/domain/jsx-graph";

import {
  jsxGraphFromMarkdownSource,
  parseJsxGraphPresentation,
} from "./jsx-graph-markdown";

describe("jsxGraphFromMarkdownSource", () => {
  it("creates a render-only block without changing the source", () => {
    const source = jsxGraphExamples.geometry;
    const graph = jsxGraphFromMarkdownSource(source, "de");
    expect(graph).toMatchObject({
      type: "jsxGraph",
      source,
      label: "Dynamisches Dreieck",
    });
  });

  it("keeps unsafe, inaccessible, and 3D source inert", () => {
    expect(jsxGraphFromMarkdownSource("A = point(1, 2)", "de")).toBeNull();
    expect(
      jsxGraphFromMarkdownSource(
        'describe "x"\nA = point(fetch("https://example.org"), 1)',
        "de",
      ),
    ).toBeNull();
    expect(
      jsxGraphFromMarkdownSource('describe "x"\nA = point3D(1, 2, 3)', "de"),
    ).toBeNull();
  });

  it("reuses the bounded Mermaid presentation syntax", () => {
    expect(parseJsxGraphPresentation("{w=90% h=70% bg=#18212f80}")).toEqual({
      widthPercent: 90,
      height: { value: 70, unit: "viewportPercent" },
      background: "#18212f80",
    });
    expect(parseJsxGraphPresentation("{style=position:fixed}")).toBeNull();
  });
});
