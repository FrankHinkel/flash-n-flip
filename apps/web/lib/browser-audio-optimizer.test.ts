import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./browser-audio-optimizer.ts", import.meta.url),
  "utf8",
);

describe("portable browser audio optimizer", () => {
  it("denoises before trimming, loudness normalization and AAC encoding", () => {
    const filterPipeline = source.slice(source.indexOf("const filters = ["));
    const highPass = filterPipeline.indexOf('"highpass=f=80"');
    const denoise = filterPipeline.indexOf('"afftdn=nr=12:nf=-45:tn=1"');
    const silence = filterPipeline.indexOf('"silenceremove=');
    const loudness = filterPipeline.indexOf(
      "`loudnorm=I=${speechAudioPipeline.targetLufs}",
    );

    expect(highPass).toBeGreaterThan(0);
    expect(denoise).toBeGreaterThan(highPass);
    expect(silence).toBeGreaterThan(denoise);
    expect(loudness).toBeGreaterThan(silence);
    expect(filterPipeline).toContain('"-c:a",\n      "aac"');
  });
});
