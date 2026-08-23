import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  musicAbcForDisplay,
  onsetElementGroupCount,
  pianoHandAtSourcePosition,
} from "./music-renderer";

const renderer = readFileSync(
  new URL("./music-renderer.ts", import.meta.url),
  "utf8",
);

describe("music renderer security boundary", () => {
  it("uses only the local visual renderer and the shared SVG sanitizer", () => {
    expect(renderer).toContain('await import("abcjs")');
    expect(renderer).toContain("sanitizeSvgBytes");
    expect(renderer).toContain('responsive: "resize"');
    expect(renderer).toContain("stop_on_warning: true");
    expect(renderer).not.toContain(".synth");
    expect(renderer).not.toContain("soundFont");
    expect(renderer).not.toContain("fetch(");
  });

  it("converts only abcjs' bounded scale style to inert SVG transforms", () => {
    expect(renderer).toContain("abcjsScaleStyle");
    expect(renderer).toContain('element.setAttribute(\n    "transform"');
    expect(renderer).toContain('element.removeAttribute("style")');
    expect(renderer).toContain("if (!normalizeAbcjsScaleStyle(element))");
  });

  it("removes abcjs metadata that is not needed for inert notation", () => {
    expect(renderer).toContain('querySelectorAll("style, title")');
    expect(renderer).toContain('attribute.name.startsWith("data-")');
    expect(renderer).toContain('attribute.name === "selectable"');
    expect(renderer).toContain('attribute.name === "text-decoration"');
  });

  it("groups piano hands into two staves without exposing authored directives", () => {
    const abc =
      "X:1\nM:3/8\nL:1/8\nV:RH clef=treble\nV:LH clef=bass\nK:Am\n[V:RH] [Ace] B c |\n[V:LH] A,, E, A, |";
    const display = {
      staffScale: "normal" as const,
      sizePercent: 70,
      keyboard: "notes" as const,
      barsPerLine: "auto" as const,
      responsive: true as const,
    };
    expect(
      musicAbcForDisplay({
        type: "musicScore",
        version: 1,
        abc,
        label: "Klavier",
        description: "Zwei Hände.",
        display,
      }),
    ).toContain("%%score { RH | LH }");
    expect(
      musicAbcForDisplay({
        type: "musicScore",
        version: 1,
        abc,
        label: "Klavier",
        description: "Rechte Hand.",
        display: { ...display, selectedVoice: "RH" },
      }),
    ).not.toContain("[V:LH]");
  });

  it("maps declared treble and bass voices to right and left hand", () => {
    const abc =
      "X:1\nV:RH clef=treble\nV:LH clef=bass\nK:C\n[V:RH] C |\n[V:LH] C, |";
    const clefs = { RH: "treble", LH: "bass" } as const;
    expect(
      pianoHandAtSourcePosition(abc, abc.indexOf("[V:RH]") + 6, clefs),
    ).toBe("right");
    expect(
      pianoHandAtSourcePosition(abc, abc.indexOf("[V:LH]") + 6, clefs),
    ).toBe("left");
  });

  it("does not reactivate later SVG continuations of a tied note", () => {
    expect(onsetElementGroupCount(3, 1)).toBe(1);
    expect(onsetElementGroupCount(2, 2)).toBe(2);
    expect(onsetElementGroupCount(2, undefined)).toBe(2);
  });
});
