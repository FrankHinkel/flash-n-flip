import { describe, expect, it } from "vitest";

import {
  ankiMathToMarkdown,
  ankiClozeParts,
  ankiClozePlainText,
  parseAnkiCloze,
  parseAnkiMath,
} from "./anki-cloze.js";

describe("Anki cloze semantics", () => {
  it("creates one active card per ordinal and reveals only that answer", () => {
    const parsed = parseAnkiCloze(
      "The diagonal elements of a {{c1::skew-symmetrical}} matrix are always {{c2::zero}}.",
    );

    expect(parsed).not.toBeNull();
    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "The diagonal elements of a […] matrix are always zero.",
    );
    expect(ankiClozePlainText(parsed!, 2, false)).toBe(
      "The diagonal elements of a skew-symmetrical matrix are always […].",
    );
    expect(ankiClozeParts(parsed!, 1, true)).toContainEqual({
      kind: "answer",
      text: "skew-symmetrical",
    });
    expect(ankiClozeParts(parsed!, 1, true)).not.toContainEqual({
      kind: "answer",
      text: "zero",
    });
  });

  it("hides repeated deletions with the same ordinal together", () => {
    const parsed = parseAnkiCloze(
      "{{c1::First}} and {{c1::second}} but {{c2::third}}.",
    );

    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "[…] and […] but third.",
    );
  });

  it("uses Anki hints without turning them into answer choices", () => {
    const parsed = parseAnkiCloze(
      "Free neutron is {{c1::unstable::stable or unstable}}.",
    );

    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "Free neutron is [stable or unstable].",
    );
    expect(parsed?.deletions[0]?.hint).toBe("stable or unstable");
  });

  it("supports nested deletions and keeps inner answers in the outer range", () => {
    const parsed = parseAnkiCloze(
      "{{c1::Canberra was {{c2::founded}}}} in 1913.",
    );

    expect(parsed?.text).toBe("Canberra was founded in 1913.");
    expect(ankiClozePlainText(parsed!, 1, false)).toBe("[…] in 1913.");
    expect(ankiClozePlainText(parsed!, 2, false)).toBe(
      "Canberra was […] in 1913.",
    );
  });

  it("does not confuse balanced formula braces with the cloze terminator", () => {
    const parsed = parseAnkiCloze("Value: {{c1::\\(\\frac{a^{2}}{b}\\)}}.");

    expect(parsed?.text).toBe("Value: \\frac{a^{2}}{b}.");
    expect(parsed?.deletions).toEqual([
      expect.objectContaining({ id: 1, start: 7, end: 22 }),
    ]);
    expect(parsed?.mathRanges).toEqual([
      { start: 7, end: 22, display: false, latex: "\\frac{a^{2}}{b}" },
    ]);
  });

  it("rejects malformed or empty deletions without discarding source text", () => {
    expect(parseAnkiCloze("Broken {{c1::answer")).toBeNull();
    expect(parseAnkiCloze("Empty {{c1::}}")).toBeNull();
  });

  it("keeps meaningful clozes when an add-on also declares an empty group", () => {
    expect(
      parseAnkiCloze("{{c1::First}} and {{c2::second}} {{c3::}}"),
    ).toMatchObject({
      text: "First and second ",
      deletions: [
        { id: 1, start: 0, end: 5 },
        { id: 2, start: 10, end: 16 },
      ],
      emptyDeletionIds: [3],
    });
  });

  it("normalizes Anki MathJax inside and outside separate cloze answers", () => {
    const parsed = parseAnkiCloze(
      "{{c1::\\(\\cos (x+y)\\)}} \\(=\\) {{c2::\\(\\cos x \\cdot \\cos y-\\sin x \\sin y\\)}}",
    );

    expect(parsed).toMatchObject({
      text: "\\cos (x+y) = \\cos x \\cdot \\cos y-\\sin x \\sin y",
      warnings: [],
    });
    expect(parsed?.mathRanges).toEqual([
      expect.objectContaining({ display: false, latex: "\\cos (x+y)" }),
      expect.objectContaining({ display: false, latex: "=" }),
      expect.objectContaining({
        display: false,
        latex: "\\cos x \\cdot \\cos y-\\sin x \\sin y",
      }),
    ]);
    expect(ankiClozePlainText(parsed!, 1, false)).toBe(
      "[…] = \\cos x \\cdot \\cos y-\\sin x \\sin y",
    );
    expect(ankiClozePlainText(parsed!, 2, false)).toBe("\\cos (x+y) = […]");
  });

  it("maps a cloze nested inside a formula onto the normalized math text", () => {
    const parsed = parseAnkiCloze("\\({{c1::x^2::power}}+y\\)");

    expect(parsed).toMatchObject({
      text: "x^2+y",
      deletions: [{ id: 1, start: 0, end: 3, hint: "power" }],
      mathRanges: [{ start: 0, end: 5, display: false, latex: "x^2+y" }],
    });
  });

  it.each([
    ["\\(x+1\\)", false],
    ["\\[x+1\\]", true],
    ["[$]x+1[/$]", false],
    ["[$$]x+1[/$$]", true],
    ["[latex]x+1[/latex]", true],
    ["$x+1$", false],
    ["$$x+1$$", true],
  ])("supports the Anki math delimiter %s", (source, display) => {
    expect(parseAnkiMath(source)).toEqual({
      text: "x+1",
      mathRanges: [{ start: 0, end: 3, display, latex: "x+1" }],
      warnings: [],
    });
  });

  it("supports multiline block formulas and multiple formulas", () => {
    const parsed = parseAnkiMath("A \\[x +\ny\\] B \\(z\\)");

    expect(parsed.text).toBe("A x +\ny B z");
    expect(parsed.mathRanges).toHaveLength(2);
    expect(parsed.mathRanges[0]).toMatchObject({
      display: true,
      latex: "x +\ny",
    });
  });

  it("keeps unsafe and malformed formulas visible with bounded warnings", () => {
    expect(parseAnkiMath("[latex]\\input{secret}[/latex]")).toEqual({
      text: "\\input{secret}",
      mathRanges: [],
      warnings: [
        "Nicht unterstützte oder unsichere Anki-Formel wurde als Text beibehalten.",
      ],
    });
    expect(parseAnkiMath("Before \\(x+1")).toEqual({
      text: "Before \\(x+1",
      mathRanges: [],
      warnings: ["Unvollständige Anki-Formel wurde als Text beibehalten."],
    });
  });

  it("converts supported normal-card formulas to safe Markdown math", () => {
    expect(ankiMathToMarkdown("A \\(x\\) and [$$]y[/$$]")).toMatchObject({
      text: "A $x$ and $$y$$",
      warnings: [],
    });
  });
});
