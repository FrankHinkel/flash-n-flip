import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  abcjsScaleTransform,
  findMusicMeasureDiagnostics,
  isDiscardedAbcjsSvgAttribute,
  musicAbcForDisplay,
  musicAbcWithoutFingerings,
  normalizeAbcjsAriaLabel,
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
    expect(renderer).toContain("stop_on_warning: false");
    expect(renderer).not.toContain(".synth");
    expect(renderer).not.toContain("soundFont");
    expect(renderer).not.toContain("fetch(");
  });

  it("converts only abcjs' bounded scale style to inert SVG transforms", () => {
    expect(renderer).toContain("abcjsScaleStyle");
    expect(renderer).toContain('element.setAttribute("transform", transform)');
    expect(renderer).toContain('element.removeAttribute("style")');
    expect(renderer).toContain("if (!normalizeAbcjsScaleStyle(element))");
  });

  it("accepts bounded transform origins from long narrow scores", () => {
    expect(
      abcjsScaleTransform(
        "transform:scale(0.6,0.6);transform-origin:109.153px 31913.379px;",
      ),
    ).toBe(
      "translate(109.153 31913.379) scale(0.6 0.6) translate(-109.153 -31913.379)",
    );
    expect(
      abcjsScaleTransform(
        "transform:scale(101,0.6);transform-origin:109.153px 31913.379px;",
      ),
    ).toBeNull();
    expect(
      abcjsScaleTransform(
        "transform:scale(0.6,0.6);transform-origin:109.153px 100001px;",
      ),
    ).toBeNull();
  });

  it("removes abcjs metadata that is not needed for inert notation", () => {
    expect(renderer).toContain('querySelectorAll("style, title")');
    expect(renderer).toContain("isDiscardedAbcjsSvgAttribute(attribute.name)");
  });

  it("removes inert abcjs crescendo highlighting metadata", () => {
    expect(isDiscardedAbcjsSvgAttribute("highlight")).toBe(true);
    expect(isDiscardedAbcjsSvgAttribute("data-index")).toBe(true);
    expect(isDiscardedAbcjsSvgAttribute("stroke")).toBe(false);
  });

  it("keeps titled scores accessible without XML entities", () => {
    expect(normalizeAbcjsAriaLabel('Sheet Music for "Moonlight"')).toBe(
      "Sheet Music for 'Moonlight'",
    );
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

  it("hides only numeric fingering annotations when requested", () => {
    const abc =
      'X:1\nK:C\n"^1"C "_3"D "^(1-2)"E "^Allegretto"F |';
    expect(musicAbcWithoutFingerings(abc)).toBe(
      'X:1\nK:C\nC D E "^Allegretto"F |',
    );
    expect(
      musicAbcForDisplay({
        type: "musicScore",
        version: 1,
        abc,
        label: "Fingerings",
        description: "Optional fingerings.",
        display: {
          staffScale: "normal",
          sizePercent: 100,
          keyboard: "off",
          barsPerLine: "auto",
          fingerings: "off",
          responsive: true,
        },
      }),
    ).not.toMatch(/"[\^_](?:\([1-5](?:-[1-5])?\)|[1-5](?:-[1-5])?)"/u);
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

  it("finds an overlong measure in only the affected piano voice", async () => {
    const malformed =
      "X:1\nM:3/8\nL:1/16\nV:RH clef=treble\nV:LH clef=bass\nK:C\n[V:RH] z2|C6|C6 C6|C6|\n[V:LH] z2|C6|C6|C6|C6|";
    const corrected = malformed.replace("C6 C6|", "C6|C6|");
    const { default: abcjs } = await import("abcjs");

    expect(
      findMusicMeasureDiagnostics(abcjs.parseOnly(malformed)[0]!, malformed),
    ).toMatchObject([
      {
        voice: "RH",
        measure: 3,
        actualUnits: 12,
        expectedUnits: 6,
        unitDenominator: 16,
      },
    ]);
    expect(
      findMusicMeasureDiagnostics(abcjs.parseOnly(corrected)[0]!, corrected),
    ).toEqual([]);
  });

  it("accepts complementary cadence and pickup bars after repeat unfolding", async () => {
    const source =
      "X:1\nM:2/4\nL:1/16\nV:RH clef=treble\nV:LH clef=bass\nK:C\n[V:RH] C8|E4|ABcd|G8|\n[V:LH] C,8|E,8|A,8|G,8|";
    const { default: abcjs } = await import("abcjs");

    expect(
      findMusicMeasureDiagnostics(abcjs.parseOnly(source)[0]!, source),
    ).toEqual([]);
  });

  it("does not count abcjs grace-note render elements as bar duration", () => {
    const note = (duration: number, startChar: number, endChar: number) => ({
      el_type: "note",
      duration,
      startChar,
      endChar,
    });
    const bar = (position: number) => ({
      el_type: "bar",
      type: "bar_thin",
      startChar: position,
      endChar: position + 1,
    });
    const visual = {
      getBarLength: () => 1,
      lines: [
        {
          staff: [
            {
              voices: [
                [
                  note(1, 1, 2),
                  bar(2),
                  {
                    ...note(0.5, 3, 4),
                    gracenotes: [{ duration: 0.125 }],
                  },
                  note(0.5, 4, 5),
                  {
                    ...note(0.125, 6, 7),
                    gracenotes: [{ duration: 0.125 }],
                  },
                  bar(5),
                  note(1, 7, 8),
                  bar(8),
                ],
              ],
            },
          ],
        },
      ],
    } as unknown as Parameters<typeof findMusicMeasureDiagnostics>[0];

    expect(
      findMusicMeasureDiagnostics(visual, "X:1\nL:1/8\nK:C\nC|C|C|"),
    ).toEqual([]);
  });

  it("accepts the corrected full Für Elise example including tuplets", async () => {
    const source = readFileSync(
      new URL("../../../examples/music/fuer_elise.abc", import.meta.url),
      "utf8",
    )
      .replace(/^```music\n/u, "")
      .replace(/\n```\s*$/u, "");
    const { default: abcjs } = await import("abcjs");

    expect(
      findMusicMeasureDiagnostics(abcjs.parseOnly(source)[0]!, source),
    ).toEqual([]);
  });
});
