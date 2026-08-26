import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { markdownToRichTextDocument } from "@flashcards/domain/content";
import { validateMusicScoreAbc } from "@flashcards/domain/music-score";

import {
  musicScoreFromMarkdownSource,
  musicScoresFromMarkdownSource,
} from "./music-markdown";
import {
  findMusicMeasureDiagnostics,
  musicAbcForDisplay,
} from "./music-renderer";

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
      presentation: {
        sizePercent: 100,
        width: { value: 100, unit: "percent" },
        height: { value: 50, unit: "viewportHeight" },
        background: "auto",
      },
    });
  });

  it("parses bounded compact size and voice selection metadata", () => {
    const duet = `${example}\nV:RH clef=treble\n[V:RH] C D E F`;
    expect(
      musicScoreFromMarkdownSource(
        duet,
        "de",
        "{size=70 bars=4 select=RH keyboard=keys w=90% h=500px bg=#235f}",
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
      musicScoreFromMarkdownSource(
        duet,
        "de",
        "{size=70% bars=4 select=RH keyboard=keys w=90 h=80 bg=#235f}",
      )?.presentation,
    ).toMatchObject({
      sizePercent: 70,
      width: { value: 90, unit: "percent" },
      height: { value: 80, unit: "percent" },
      background: "#235f",
    });
    expect(
      musicScoreFromMarkdownSource(example, "de", "{size=10%}")?.display
        .sizePercent,
    ).toBe(100);
    expect(
      musicScoreFromMarkdownSource(example, "de", "{style=position:fixed}"),
    ).not.toBeNull();
    expect(
      musicScoreFromMarkdownSource(example, "de", "{keyboard=flute}")?.display
        .keyboard,
    ).toBe("notes");
    expect(
      musicScoreFromMarkdownSource(example, "de", "{bars=13}")?.display
        .barsPerLine,
    ).toBe("auto");
  });

  it("removes comments and directives before validation and rendering", () => {
    const score = musicScoreFromMarkdownSource(
      `${example}\n%%MIDI chordname dim 0 3 6 9\n% comment`,
      "de",
    );
    expect(score?.abc).toBe(example);
  });

  it("renders a fenced piano score with a standard staves directive", () => {
    const source = `\`\`\`abc
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
\`\`\``;
    const score = musicScoreFromMarkdownSource(source, "de");

    expect(score).not.toBeNull();
    expect(score?.abc).not.toContain("%%staves");
    expect(score?.abc).toContain("V:V1 clef=treble");
    expect(score?.abc).toContain("V:V2 clef=bass");
    expect(musicAbcForDisplay(score!)).toContain("%%score { V1 | V2 }");
  });

  it("prepares Chopin-style subtitles, minor keys and escaped flats for audio", async () => {
    const source = String.raw`X:1
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

[V:LH] [G,B,E]2 [G,B,E]2 [G,B,E]2 [G,B,E]2 |`;
    const score = musicScoreFromMarkdownSource(source, "de");

    expect(score?.label).toBe("Prélude");
    expect(score?.abc).toContain("T:Op. 28 Nr. 4");
    expect(score?.abc).toContain("K:Emin");
    expect(score?.abc).toContain("B4 _B2");
    expect(score?.abc).not.toContain("\\_B2");

    const { default: abcjs } = await import("abcjs");
    const visual = abcjs.parseOnly(musicAbcForDisplay(score!), {
      stop_on_warning: false,
    })[0];
    expect(visual).toBeDefined();
    const audio = visual!.setUpAudio({});
    expect(audio.totalDuration).toBeGreaterThan(0);
    expect(audio.tracks).toHaveLength(2);
  });

  it.each([
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

  it("imports, separates and prepares playback for fenced ABC tune books", async () => {
    const entertainer = `\`\`\`abc
X:436
T:The Entertainer
C:Scott Joplin
R:Rag
S:example.org
%%MIDI chordname dim 0 3 6 9
K:C
P:Tune
"/"C D E F |
\`\`\``;
    const moonlight = `\`\`\`music
X:1
T:I. Adagio sostenuto
M:4/4
L:1/8
Q:1/4=50
K:E
V:1
V:1(3G,CE (3G,CE | V:2[C,-C,,-]6 z2 |

X:2
T:II. Allegretto
M:3/4
L:1/8
Q:1/4=150
K:Db
V:1
V:1[dA]2 [cA]4 | V:2F2 E4 |

X:3
T:III. Presto
M:4/4
L:1/8
Q:1/4=144
K:E
V:1
V:1z/2G,,/2C,/2E,/2 G,/2C,/2E,/2G,/2 | V:2C,,/2z/2G,,/2z/2 C,,2 |
\`\`\``;
    const entertainerScores = musicScoresFromMarkdownSource(entertainer, "de");
    const moonlightScores = musicScoresFromMarkdownSource(moonlight, "de");

    expect(entertainerScores).toHaveLength(1);
    expect(entertainerScores[0]?.label).toBe("The Entertainer");
    expect(entertainerScores[0]?.abc).not.toMatch(/```|%%MIDI|%NoValidate/u);
    expect(moonlightScores.map(({ label }) => label)).toEqual([
      "I. Adagio sostenuto",
      "II. Allegretto",
      "III. Presto",
    ]);
    expect(
      moonlightScores.every(({ abc }) => abc.includes("V:1 clef=treble")),
    ).toBe(true);
    expect(
      moonlightScores.every(({ abc }) => abc.includes("V:2 clef=bass")),
    ).toBe(true);

    const { default: abcjs } = await import("abcjs");
    for (const score of [...entertainerScores, ...moonlightScores]) {
      const visual = abcjs.parseOnly(musicAbcForDisplay(score), {
        stop_on_warning: true,
      })[0];
      expect(visual).toBeDefined();
      expect(() => visual!.setUpAudio({})).not.toThrow();
    }
  });

  it("renders and prepares playback for the complete Joplin and Moonlight examples", async () => {
    const entertainer = readFileSync(
      new URL("../../../examples/music/entertainer.md", import.meta.url),
      "utf8",
    );
    const mapleLeafRag = readFileSync(
      new URL("../../../examples/music/maple-leaf-rag.md", import.meta.url),
      "utf8",
    );
    const moonlight = readFileSync(
      new URL("../../../examples/music/mondscheinsonate.abc", import.meta.url),
      "utf8",
    );
    const scoresFromEditorSource = (source: string) => {
      const document = markdownToRichTextDocument(source);
      const codeBlock = document.content[0];
      expect(codeBlock?.type).toBe("codeBlock");
      const code = (codeBlock?.content ?? [])
        .map((node) => node.text ?? "")
        .join("");
      return musicScoresFromMarkdownSource(code, "de", codeBlock?.attrs?.meta);
    };
    const scores = [
      ...scoresFromEditorSource(entertainer),
      ...scoresFromEditorSource(mapleLeafRag),
      ...scoresFromEditorSource(moonlight),
    ];

    expect(scores.map(({ label }) => label)).toEqual([
      "The Entertainer",
      "Maple Leaf Rag",
      "Beethoven - Mondscheinsonate Op.27/2 I. Adagio sostenuto",
      "Beethoven - Mondscheinsonate Op.27/2 II. Allegretto",
      "Beethoven - Mondscheinsonate Op.27/2 III. Presto",
    ]);

    const { default: abcjs } = await import("abcjs");
    for (const score of scores) {
      const metrics = validateMusicScoreAbc(score.abc);
      if (
        score.label === "The Entertainer" ||
        score.label === "Maple Leaf Rag"
      ) {
        expect(metrics.voices).toEqual(["RH", "LH"]);
        expect(metrics.eventCount).toBeGreaterThan(1_000);
        expect(
          new Set(
            metrics.voices.map((voice) =>
              Math.max(
                ...metrics.events
                  .filter((event) => event.voice === voice)
                  .map((event) => event.measure),
              ),
            ),
          ).size,
        ).toBe(1);
      }
      const visual = abcjs.parseOnly(musicAbcForDisplay(score), {
        stop_on_warning: true,
      })[0];
      expect(visual).toBeDefined();
      expect(() => visual!.setUpAudio({})).not.toThrow();
    }
  });

  it("renders and prepares the complete Rondo alla Turca and Hummelflug piano scores", async () => {
    const files = ["rondo-alla-turca.md", "hummelflug.md"];
    const scores = files.map((file) => {
      const source = readFileSync(
        new URL(`../../../examples/music/${file}`, import.meta.url),
        "utf8",
      );
      const document = markdownToRichTextDocument(source);
      const codeBlock = document.content[0];
      expect(codeBlock?.type, file).toBe("codeBlock");
      const code = (codeBlock?.content ?? [])
        .map((node) => node.text ?? "")
        .join("");
      const score = musicScoreFromMarkdownSource(
        code,
        "de",
        codeBlock?.attrs?.meta,
      );
      expect(score, file).not.toBeNull();
      return score!;
    });

    expect(scores.map(({ label }) => label)).toEqual([
      "Rondo alla Turca",
      "Hummelflug",
    ]);
    expect(validateMusicScoreAbc(scores[0]!.abc).voices).toEqual(["RH", "LH"]);
    expect(validateMusicScoreAbc(scores[1]!.abc).voices).toEqual([
      "RH1",
      "RH2",
      "RH3",
      "LH1",
      "LH2",
      "LH3",
    ]);

    const { default: abcjs } = await import("abcjs");
    for (const score of scores) {
      const metrics = validateMusicScoreAbc(score.abc);
      expect(metrics.eventCount, score.label).toBeGreaterThan(1_000);
      expect(
        new Set(
          metrics.voices.map((voice) =>
            Math.max(
              ...metrics.events
                .filter((event) => event.voice === voice)
                .map((event) => event.measure),
            ),
          ),
        ).size,
        score.label,
      ).toBe(1);
      const displayAbc = musicAbcForDisplay(score);
      const visual = abcjs.parseOnly(displayAbc, {
        stop_on_warning: false,
      })[0];
      expect(visual, score.label).toBeDefined();
      expect(() => visual!.setUpAudio({}), score.label).not.toThrow();
      if (score.label === "Hummelflug") {
        const staffVoiceCounts = (visual!.lines ?? []).flatMap((line) =>
          (line.staff ?? []).map((staff) => staff.voices?.length ?? 0),
        );
        expect(staffVoiceCounts).toEqual([3, 3]);
        const audio = visual!.setUpAudio({});
        expect(audio.tracks).toHaveLength(6);
        expect(audio.totalDuration).toBeGreaterThan(50);
      }
    }
  });

  it("keeps all ten easy piano examples playable with the right hand alone", async () => {
    const library = new URL(
      "../../../examples/music/easy-piano/",
      import.meta.url,
    );
    const files = readdirSync(library)
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .sort();
    expect(files).toHaveLength(10);

    const { default: abcjs } = await import("abcjs");
    for (const file of files) {
      const source = readFileSync(new URL(file, library), "utf8");
      const document = markdownToRichTextDocument(source);
      const codeBlock = document.content[0];
      expect(codeBlock?.type, file).toBe("codeBlock");
      const code = (codeBlock?.content ?? [])
        .map((node) => node.text ?? "")
        .join("");
      const score = musicScoreFromMarkdownSource(
        code,
        "de",
        codeBlock?.attrs?.meta,
      );
      expect(score, file).not.toBeNull();
      const metrics = validateMusicScoreAbc(score!.abc);
      expect(metrics.voices, file).toEqual(["RH", "LH"]);

      const displayAbc = musicAbcForDisplay(score!);
      const complete = abcjs.parseOnly(displayAbc, {
        stop_on_warning: true,
      })[0];
      expect(complete, file).toBeDefined();
      expect(findMusicMeasureDiagnostics(complete!, displayAbc), file).toEqual(
        [],
      );
      expect(() => complete!.setUpAudio({}), file).not.toThrow();

      const rightHand = abcjs.parseOnly(
        musicAbcForDisplay({
          ...score!,
          display: { ...score!.display, selectedVoice: "RH" },
        }),
        { stop_on_warning: true },
      )[0];
      expect(rightHand, file).toBeDefined();
      expect(() => rightHand!.setUpAudio({}), file).not.toThrow();
    }
  });

  it("keeps the three complete reference melodies intact", () => {
    const expectedRightHands = new Map([
      [
        "ode-an-die-freude.md",
        "[V:RH] B B c d | d c B A | G G A B | B>A A2 | B B c d | d c B A | G G A B | A>G G2 | A A B G | A B/2c/2 B G | A B/2c/2 B A | G A D2 | B B c d | d c B A | G G A B | A>G G2 |",
      ],
      [
        "amazing-grace.md",
        "[V:RH] z4 D2 | G4 B G | B4 A2 | G4 E2 | D4 D2 | G4 B G | B4 A2 | d6- | d2 z2 B2 | d3 B d B | G4 D2 | E3 G G E | D4 D2 | G4 B G | B4 A2 | G6 |",
      ],
      [
        "when-the-saints.md",
        "[V:RH] z C E F | G4 | z C E F | G4 | z C E F | G2 E2 | C2 E2 | D4 | z E E D | C4 | E2 G2 | G F3 | z2 E F | G2 E2 | C2 D2 | C4 |",
      ],
    ]);
    const library = new URL(
      "../../../examples/music/easy-piano/",
      import.meta.url,
    );

    for (const [file, expected] of expectedRightHands) {
      const source = readFileSync(new URL(file, library), "utf8");
      const rightHand = source.match(/^\[V:RH\].+$/mu)?.[0];
      expect(rightHand, file).toBe(expected);
      const document = markdownToRichTextDocument(source);
      const codeBlock = document.content[0];
      const code = (codeBlock?.content ?? [])
        .map((node) => node.text ?? "")
        .join("");
      const score = musicScoreFromMarkdownSource(
        code,
        "de",
        codeBlock?.attrs?.meta,
      );
      expect(score, file).not.toBeNull();
      expect(validateMusicScoreAbc(score!.abc).measureCount, file).toBe(16);
    }
  });

  it("rejects missing required headers and excessive complexity", () => {
    expect(musicScoreFromMarkdownSource("K:C\nC D E F", "de")).toBeNull();
    expect(
      musicScoreFromMarkdownSource("X:1\nT:abcdef\nK:C\nhello", "de"),
    ).toBeNull();
    expect(musicScoreFromMarkdownSource('X:1\nK:C\n"C"', "de")).toBeNull();
    expect(
      musicScoreFromMarkdownSource(
        `X:1\nK:C\n${Array.from({ length: 10_001 }, () => "C").join(" ")}`,
        "de",
      ),
    ).toBeNull();
  });

  it("accepts at most twelve explicitly named voices", () => {
    const voices = (count: number) =>
      `X:1\nK:C\n${Array.from({ length: count }, (_, index) => `V:v${index + 1}`).join("\n")}\n[V:v1] C D E F`;
    expect(musicScoreFromMarkdownSource(voices(12), "de")).not.toBeNull();
    expect(musicScoreFromMarkdownSource(voices(13), "de")).toBeNull();
  });
});
