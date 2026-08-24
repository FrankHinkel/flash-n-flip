import { describe, expect, it } from "vitest";

import {
  jsxGraphBlockSchema,
  jsxGraphExamples,
  parseJsxGraphExpression,
  validateJsxGraphSource,
} from "./jsx-graph";

describe("JSXGraph content", () => {
  it.each(Object.entries(jsxGraphExamples))(
    "accepts the bounded %s example",
    (_, source) => {
      const metrics = validateJsxGraphSource(source);
      expect(metrics.objectCount).toBeGreaterThan(0);
      expect(metrics.expressionNodeCount).toBeGreaterThan(0);
      expect(
        jsxGraphBlockSchema.parse({
          type: "jsxGraph",
          version: 1,
          source,
          label: metrics.program.title ?? "Interactive graph",
          description: metrics.program.description,
        }),
      ).toMatchObject({ type: "jsxGraph", source });
    },
  );

  it("parses mathematical expressions without executing code", () => {
    expect(parseJsxGraphExpression("a * sin(c*x) + b")).toMatchObject({
      kind: "binary",
      operator: "+",
    });
    expect(parseJsxGraphExpression("A.x^2 + A.y^2")).toMatchObject({
      kind: "binary",
      operator: "+",
    });
  });

  it("accepts bounded trace, interpolation, and presentation options", () => {
    const metrics = validateJsxGraphSource(jsxGraphExamples.interpolation);
    expect(metrics.program.board.clearTraces).toBe(true);
    expect(metrics.program.statements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "assignment", name: "T" }),
      ]),
    );
  });

  it.each([
    'describe "unsafe"\nboard axes\n<script>alert(1)</script>',
    'describe "unsafe"\nA = point(fetch("https://example.org"), 1)',
    'describe "unsafe"\nA = point(window.x, 1)',
    'describe "unsafe"\nA = point3D(1, 2, 3)',
    'describe "unsafe"\nA = image("https://example.org/a.png")',
    'describe "unsafe"\nA = point(__proto__.x, 1)',
  ])("rejects executable, external, HTML, and 3D input: %s", (source) => {
    expect(() => validateJsxGraphSource(source)).toThrow();
  });

  it("rejects missing accessibility text, unknown functions, and cycles", () => {
    expect(() => validateJsxGraphSource("board axes\nA = point(1, 2)")).toThrow(
      /describe/,
    );
    expect(() =>
      validateJsxGraphSource('describe "x"\nA = unknown(1)'),
    ).toThrow(/unsupported function/);
    expect(() =>
      validateJsxGraphSource('describe "x"\na = b + 1\nb = a + 1'),
    ).toThrow(/cycle/);
    expect(() =>
      validateJsxGraphSource('describe "x"\nA = point(1, 2, href="x")'),
    ).toThrow(/named argument/);
    expect(() =>
      validateJsxGraphSource('describe "x"\nA = point(1, 2)\na = A.secret'),
    ).toThrow(/property/);
  });

  it.each([
    ['describe "x"\nA = point(0, 0, face="html")', /point face/],
    [
      'describe "x"\nf(x) = x\nR = riemann(f, method="random")',
      /Riemann method/,
    ],
    ['describe "x"\na = random(0, 1)', /minimum, maximum, seed/],
    ['describe "x"\nA = point(0, 0)\nf = lagrange(A)', /2 to 16/],
    ['describe "x"\nA = point(0, 0)\nT = tracecurve(A)', /two objects/],
  ])("rejects unsupported bounded option values: %s", (source, message) => {
    expect(() => validateJsxGraphSource(source)).toThrow(message);
  });

  it("bounds statements, sliders, and source size", () => {
    const sliders = Array.from(
      { length: 25 },
      (_, index) => `s${index} = slider(0, 1, value=0.5)`,
    ).join("\n");
    expect(() =>
      validateJsxGraphSource(`describe "Too many"\n${sliders}`),
    ).toThrow(/limits/);
    expect(() =>
      validateJsxGraphSource(
        `describe "Too many"\n${sliders.replaceAll(/s\d+ = /g, "")}`,
      ),
    ).toThrow(/limits/);
    expect(() => validateJsxGraphSource("x".repeat(30_001))).toThrow(/30,000/);
  });
});
