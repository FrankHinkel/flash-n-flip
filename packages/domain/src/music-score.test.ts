import { describe, expect, it } from "vitest";

import {
  musicScoreBlockSchema,
  normalizeMusicScoreAbc,
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
        `X:1\nK:C\n${Array.from({ length: 17 }, () => "C D E F").join("\n")}`,
      ),
    ).toThrow(/system/);
    expect(() =>
      validateMusicScoreAbc(`X:1\nK:C\n${"C | ".repeat(129)}`),
    ).toThrow(/measure/);
    expect(() =>
      validateMusicScoreAbc(
        `X:1\nK:C\n${Array.from({ length: 5 }, (_, index) => `V:v${index + 1}\nC`).join("\n")}`,
      ),
    ).toThrow(/voice/);
    expect(() =>
      validateMusicScoreAbc(`X:1\nK:C\n${"C".repeat(2_001)}`),
    ).toThrow(/event/);
    expect(() =>
      validateMusicScoreAbc(`X:1\nK:C\nC\nw:${" la".repeat(201)}`),
    ).toThrow(/syllable/);
  });
});
