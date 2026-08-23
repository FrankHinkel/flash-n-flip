import fs from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isMusicPlaybackDurationSupported,
  maximumMusicPlaybackSeconds,
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
  });

  it("accepts local scores up to and including fifteen minutes", () => {
    expect(maximumMusicPlaybackSeconds).toBe(900);
    expect(isMusicPlaybackDurationSupported(900)).toBe(true);
    expect(isMusicPlaybackDurationSupported(900.001)).toBe(false);
    expect(isMusicPlaybackDurationSupported(0)).toBe(false);
    expect(isMusicPlaybackDurationSupported(Number.NaN)).toBe(false);
  });
});
