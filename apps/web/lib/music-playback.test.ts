import fs from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isMusicPlaybackDurationSupported,
  maximumMusicPlaybackSeconds,
  musicAudioSampleRateForDevice,
  segmentMusicSequence,
} from "./music-playback";

const source = fs.readFileSync(
  new URL("./music-playback.ts", import.meta.url),
  "utf8",
);

describe("local music playback boundary", () => {
  it("uses only the bundled same-origin piano and explicit user lifecycle", () => {
    expect(source).toContain('"/soundfonts/fnf-upright-piano/"');
    expect(source).toContain("soundFontUrl.origin !== window.location.origin");
    expect(source).toContain("program: 0");
    expect(source).toContain("chordsOff: true");
    expect(source).toContain("maximumMusicPlaybackSeconds = 15 * 60");
    expect(source).toContain("isMusicPlaybackDurationSupported");
    expect(source).not.toMatch(/paulrosen\.github|midi-js-soundfonts\/Fluid/u);
  });

  it("closes its AudioContext and coordinates one active source", () => {
    expect(source).toContain("await activeSession?.destroy()");
    expect(source).toContain("await context.close()");
    expect(source).toContain("exclusiveAudioRequestEvent");
    expect(source).toContain('context.state === "suspended"');
    expect(source).toContain("await context.resume()");
    expect(source).toContain("context.createBuffer(1, 1, context.sampleRate)");
    expect(source).toContain("gain.gain.value = 0");
    expect(source).toContain("source.start(0)");
  });

  it("uses a smaller mix buffer on touch-based Apple devices", () => {
    expect(
      musicAudioSampleRateForDevice(
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
        5,
      ),
    ).toBe(24_000);
    expect(
      musicAudioSampleRateForDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        5,
      ),
    ).toBe(24_000);
    expect(
      musicAudioSampleRateForDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        0,
      ),
    ).toBeUndefined();
  });

  it("splits Apple playback into bounded buffers and preserves chords", () => {
    const visual = {
      setUpAudio: () => ({
        tempo: 120,
        tracks: [
          [
            { cmd: "program", instrument: 0 },
            { cmd: "note", pitch: 60, volume: 90, start: 19, duration: 3 },
            { cmd: "note", pitch: 64, volume: 90, start: 20, duration: 1 },
          ],
        ],
        totalDuration: 45,
      }),
      millisecondsPerMeasure: () => 1_000,
      getMeterFraction: () => ({ num: 1, den: 1 }),
    };

    const result = segmentMusicSequence(visual as never);

    expect(result.durationSeconds).toBe(45);
    expect(result.segments).toHaveLength(3);
    expect(result.segments.map((segment) => segment.durationSeconds)).toEqual([
      20, 20, 5,
    ]);
    expect(result.segments[0]!.sequence.tracks[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pitch: 60, start: 19, duration: 1 }),
      ]),
    );
    expect(result.segments[1]!.sequence.tracks[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pitch: 60, start: 0, duration: 2 }),
        expect.objectContaining({ pitch: 64, start: 0, duration: 1 }),
      ]),
    );
  });

  it("accepts local scores up to and including fifteen minutes", () => {
    expect(maximumMusicPlaybackSeconds).toBe(900);
    expect(isMusicPlaybackDurationSupported(900)).toBe(true);
    expect(isMusicPlaybackDurationSupported(900.001)).toBe(false);
    expect(isMusicPlaybackDurationSupported(0)).toBe(false);
    expect(isMusicPlaybackDurationSupported(Number.NaN)).toBe(false);
  });
});
