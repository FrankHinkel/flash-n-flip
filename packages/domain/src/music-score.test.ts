import { describe, expect, it } from "vitest";

import {
  musicScoreBlockSchema,
  normalizeMusicScoreAbc,
  prepareMusicScoreAbcBook,
  validateMusicScoreAbc,
} from "./music-score";

const scale = `X:1
T:C-Dur
M:4/4
L:1/4
Q:120
K:C clef=treble
C D E F | G A B c |`;

describe("music score content", () => {
  it("normalizes and analyzes a bounded ABC score", () => {
    expect(
      normalizeMusicScoreAbc(`\r\n${scale.replaceAll("\n", "\r\n")}\r\n`),
    ).toBe(scale);
    expect(validateMusicScoreAbc(scale)).toMatchObject({
      eventCount: 8,
      measureCount: 2,
      keySignature: "C",
      meter: "4/4",
      clef: "treble",
      tempo: 120,
      voices: ["default"],
      voiceClefs: { default: "treble" },
    });
  });

  it("keeps measure numbers across notation lines and ignores a final empty bar", () => {
    const metrics = validateMusicScoreAbc("X:1\nK:C\nC D |\nE F |");
    expect(metrics.measureCount).toBe(2);
    expect(metrics.events.map(({ measure }) => measure)).toEqual([1, 1, 2, 2]);
  });

  it("counts a bar before a natural accidental", () => {
    const metrics = validateMusicScoreAbc("X:1\nK:C\n_B B |=B B |");
    expect(metrics.measureCount).toBe(2);
    expect(metrics.events.map(({ measure }) => measure)).toEqual([1, 1, 2, 2]);
  });

  it("accepts explicit accessible text and a fixed display contract", () => {
    expect(
      musicScoreBlockSchema.parse({
        type: "musicScore",
        version: 1,
        abc: scale,
        label: "C-Dur-Tonleiter",
        description: "Acht Viertelnoten steigen von C bis zum höheren C.",
        display: {
          staffScale: "normal",
          sizePercent: 70,
          keyboard: "notes",
          barsPerLine: "auto",
          responsive: true,
        },
      }),
    ).toMatchObject({
      type: "musicScore",
      version: 1,
      display: { barsPerLine: "auto" },
    });
  });

  it("counts measures per voice and accepts bounded voice selection", () => {
    const duet =
      "X:1\nM:3/8\nL:1/8\nV:RH clef=treble\nV:LH clef=bass\nK:Am\n[V:RH] [Ace] B c | d e f |\n[V:LH] A,, E, A, | E,, B,, E, |";
    const metrics = validateMusicScoreAbc(duet);
    expect(metrics.measureCount).toBe(2);
    expect(metrics.voices).toEqual(["RH", "LH"]);
    expect(metrics.voiceClefs).toEqual({ RH: "treble", LH: "bass" });
    expect(
      musicScoreBlockSchema.parse({
        type: "musicScore",
        version: 1,
        abc: duet,
        label: "Klavier",
        description: "Zweistimmiger Klaviersatz.",
        display: {
          staffScale: "normal",
          sizePercent: 70,
          keyboard: "notes",
          barsPerLine: 4,
          selectedVoice: "RH",
          responsive: true,
        },
      }).display.selectedVoice,
    ).toBe("RH");
    expect(() =>
      musicScoreBlockSchema.parse({
        type: "musicScore",
        version: 1,
        abc: duet,
        label: "Klavier",
        description: "Zweistimmiger Klaviersatz.",
        display: {
          staffScale: "normal",
          sizePercent: 70,
          keyboard: "notes",
          barsPerLine: "auto",
          selectedVoice: "Alt",
          responsive: true,
        },
      }),
    ).toThrow(/Selected ABC voice/);
  });

  it("stores an optional fingering visibility override", () => {
    const block = musicScoreBlockSchema.parse({
      type: "musicScore",
      version: 1,
      abc: scale,
      label: "C-Dur-Tonleiter",
      description: "Fingersätze können ausgeblendet werden.",
      display: {
        staffScale: "normal",
        sizePercent: 100,
        keyboard: "notes",
        barsPerLine: "auto",
        fingerings: "off",
        responsive: true,
      },
    });
    expect(block.display.fingerings).toBe("off");
  });

  it("rejects multi-voice declarations whose music falls into only one voice", () => {
    expect(() =>
      validateMusicScoreAbc(
        "X:1\nV:RH clef=treble\nV:LH clef=bass\nK:C\nC D E F |",
      ),
    ).toThrow(/voices without musical events: RH/u);
  });

  it("prepares fenced tune books without executing comments or directives", () => {
    const tunes = prepareMusicScoreAbcBook(`\`\`\`music
X:1
T:First
%%MIDI chordname dim 0 3 6 9
K:C
V:1
V:2
V:1C D |V:2C, D, |

X:2
T:Second
K:G
G A |
\`\`\``);
    expect(tunes).toHaveLength(2);
    expect(tunes[0]).not.toContain("MIDI");
    expect(tunes[0]).toContain("V:1 clef=treble");
    expect(tunes[0]).toContain("V:2 clef=bass");
    expect(tunes[0]).toContain("[V:1]C D |[V:2]C, D, |");
    expect(
      validateMusicScoreAbc(tunes[0]!).events.map(({ voice }) => voice),
    ).toEqual(["1", "1", "2", "2"]);
  });

  it("accepts inert staff grouping directives and rebuilds their voice metadata", () => {
    const [score] = prepareMusicScoreAbcBook(`\`\`\`abc
X:1
T:Piano Example
M:4/4
L:1/4
K:C
%%staves {V1 V2}
V:V1 clef=treble
V:V2 clef=bass
[V:V1] C C G G | A A G2 |
[V:V2] C,2 E,2 | F,2 C,2 |
\`\`\``);

    expect(score).not.toContain("%%staves");
    expect(validateMusicScoreAbc(score!)).toMatchObject({
      eventCount: 11,
      measureCount: 2,
      voices: ["V1", "V2"],
      voiceClefs: { V1: "treble", V2: "bass" },
    });
  });

  it("accepts bounded subtitles, standard minor keys and escaped flat accidentals", () => {
    const [score] = prepareMusicScoreAbcBook(String.raw`X:1
T:Prélude
T:Op. 28 Nr. 4
C:Frédéric Chopin
M:2/2
L:1/8
Q:1/4=50
K:Emin
%%staves {RH LH}
V:RH clef=treble
V:LH clef=bass

[V:RH] B4 \_B2 |

[V:LH] [G,B,E]2 [G,B,E]2 [G,B,E]2 [G,B,E]2 |`);

    expect(score).toContain("T:Prélude\nT:Op. 28 Nr. 4");
    expect(score).toContain("K:Emin");
    expect(score).toContain("B4 _B2");
    expect(score).not.toContain("\\_B2");
    expect(score).not.toContain("\n\n");
    expect(validateMusicScoreAbc(score!)).toMatchObject({
      keySignature: "Emin",
      voices: ["RH", "LH"],
      voiceClefs: { RH: "treble", LH: "bass" },
    });
  });

  it("bounds the number of ABC title and subtitle fields", () => {
    const titles = Array.from(
      { length: 9 },
      (_, index) => `T:Title ${index + 1}`,
    ).join("\n");
    expect(() => validateMusicScoreAbc(`X:1\n${titles}\nK:C\nC |`)).toThrow(
      /up to eight bounded T: fields/,
    );
  });

  it("does not allowlist arbitrary ABC directives", () => {
    const [score] = prepareMusicScoreAbcBook(
      "X:1\nK:C\n%%staves {V1 V2};javascript:alert(1)\nC |",
    );
    expect(() => validateMusicScoreAbc(score!)).toThrow(/directives/);
  });

  it("accepts safe ABC metadata and the slash repeat-chord annotation", () => {
    expect(() =>
      validateMusicScoreAbc(
        'X:1\nT:Rag\nC:Composer\nR:Rag\nS:example.org\nN:Note\nK:C\nP:Tune\n"/"C D |',
      ),
    ).not.toThrow();
  });

  it("accepts a bounded long movement above the former 30,000-character limit", () => {
    const longMovement = `X:1\nK:C\n${"C/16 ".repeat(7_000)}`;
    expect(longMovement.length).toBeGreaterThan(30_000);
    expect(validateMusicScoreAbc(longMovement).eventCount).toBe(7_000);
  });

  it.each([
    "X:1\nK:C\n%%MIDI program 1\nC",
    "X:1\nK:C\nC <script>alert(1)</script>",
    'X:1\nK:C\n"javascript:alert(1)" C',
    "X:1\nK:C\nC /private/sample.mp3",
    "X:1\nU:https://example.org/font\nK:C\nC",
  ])("rejects unsafe or unsupported source: %s", (source) => {
    expect(() => validateMusicScoreAbc(source)).toThrow();
  });

  it("enforces voices, measures, systems, events and lyrics limits", () => {
    expect(() =>
      validateMusicScoreAbc(
        `X:1\nK:C\n${Array.from({ length: 65 }, () => "C D E F").join("\n")}`,
      ),
    ).toThrow(/system/);
    expect(() =>
      validateMusicScoreAbc(`X:1\nK:C\n${"C | ".repeat(513)}`),
    ).toThrow(/measure/);
    expect(() =>
      validateMusicScoreAbc(
        `X:1\nK:C\n${Array.from({ length: 13 }, (_, index) => `V:v${index + 1}\nC`).join("\n")}`,
      ),
    ).toThrow(/voice/);
    expect(() =>
      validateMusicScoreAbc(`X:1\nK:C\n${"C".repeat(10_001)}`),
    ).toThrow(/event/);
    expect(() =>
      validateMusicScoreAbc(`X:1\nK:C\nC\nw:${" la".repeat(201)}`),
    ).toThrow(/syllable/);
  });
});
