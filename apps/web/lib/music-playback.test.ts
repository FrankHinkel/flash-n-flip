import fs from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isMusicPlaybackDurationSupported,
  maximumMusicPlaybackSeconds,
  musicAudioSampleRateForDevice,
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

  it("accepts local scores up to and including fifteen minutes", () => {
    expect(maximumMusicPlaybackSeconds).toBe(900);
    expect(isMusicPlaybackDurationSupported(900)).toBe(true);
    expect(isMusicPlaybackDurationSupported(900.001)).toBe(false);
    expect(isMusicPlaybackDurationSupported(0)).toBe(false);
    expect(isMusicPlaybackDurationSupported(Number.NaN)).toBe(false);
  });
});
