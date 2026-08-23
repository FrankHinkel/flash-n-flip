import { describe, expect, it } from "vitest";

import { musicScoreFromMarkdownSource } from "./music-markdown";

const example = [
  "X:1",
  "T:C-Dur-Tonleiter",
  "M:4/4",
  "L:1/4",
  "K:C clef=treble",
  "C D E F | G A B c |",
].join("\n");

describe("musicScoreFromMarkdownSource", () => {
  it("accepts bounded ABC notation and derives accessible metadata", () => {
    expect(musicScoreFromMarkdownSource(example, "de")).toEqual({
      type: "musicScore",
      version: 1,
      abc: example,
      label: "C-Dur-Tonleiter",
      description:
        "8 musikalische Ereignisse in 2 Takten. Tonart C, Taktart 4/4, Violinschlüssel.",
      display: {
        staffScale: "normal",
        sizePercent: 100,
        keyboard: "notes",
        barsPerLine: "auto",
        responsive: true,
      },
      locale: "de",
    });
  });

  it("parses bounded compact size and voice selection metadata", () => {
    const duet = `${example}\nV:RH clef=treble\n[V:RH] C D E F`;
    expect(
      musicScoreFromMarkdownSource(
        duet,
        "de",
        "{size=70% bars=4 select=RH keyboard=keys}",
      )?.display,
    ).toEqual({
      staffScale: "normal",
      sizePercent: 70,
      keyboard: "keys",
      barsPerLine: 4,
      selectedVoice: "RH",
      responsive: true,
    });
    expect(
      musicScoreFromMarkdownSource(example, "de", "{size=10%}"),
    ).toBeNull();
    expect(
      musicScoreFromMarkdownSource(example, "de", "{style=position:fixed}"),
    ).toBeNull();
    expect(
      musicScoreFromMarkdownSource(example, "de", "{keyboard=flute}"),
    ).toBeNull();
    expect(musicScoreFromMarkdownSource(example, "de", "{bars=13}")).toBeNull();
  });

  it.each([
    "%%MIDI program 1",
    "%%abc-include https://example.org/score.abc",
    "I:score external",
    "T:<script>alert(1)</script>",
    "T:Bach & Vivaldi",
    'w:<img src=x onerror="alert(1)">',
    '"C&unsafe" C D E F',
    "T:data:text/html,unsafe",
  ])("rejects executable, external, or unsupported input: %s", (payload) => {
    expect(
      musicScoreFromMarkdownSource(`${example}\n${payload}`, "de"),
    ).toBeNull();
  });

  it("rejects missing required headers and excessive complexity", () => {
    expect(musicScoreFromMarkdownSource("K:C\nC D E F", "de")).toBeNull();
    expect(
      musicScoreFromMarkdownSource("X:1\nT:abcdef\nK:C\nhello", "de"),
    ).toBeNull();
    expect(musicScoreFromMarkdownSource('X:1\nK:C\n"C"', "de")).toBeNull();
    expect(
      musicScoreFromMarkdownSource(
        `X:1\nK:C\n${Array.from({ length: 2_001 }, () => "C").join(" ")}`,
        "de",
      ),
    ).toBeNull();
  });

  it("accepts at most four explicitly named voices", () => {
    const voices = (count: number) =>
      `X:1\nK:C\n${Array.from({ length: count }, (_, index) => `V:v${index + 1}`).join("\n")}\n[V:v1] C D E F`;
    expect(musicScoreFromMarkdownSource(voices(4), "de")).not.toBeNull();
    expect(musicScoreFromMarkdownSource(voices(5), "de")).toBeNull();
  });
});
