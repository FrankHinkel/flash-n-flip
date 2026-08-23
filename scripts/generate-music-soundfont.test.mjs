import assert from "node:assert/strict";
import test from "node:test";

import { midiNoteName, parseSfzRegions } from "./generate-music-soundfont.mjs";

test("uses the pitch names requested by abcjs", () => {
  assert.equal(midiNoteName(21), "A0");
  assert.equal(midiNoteName(60), "C4");
  assert.equal(midiNoteName(108), "C8");
});

test("parses bounded SFZ source regions", () => {
  assert.deepEqual(
    parseSfzRegions(`<region>
lokey=59
hikey=61
pitch_keycenter=60
sample=samples/C4.flac`),
    [{ low: 59, high: 61, center: 60, sample: "samples/C4.flac" }],
  );
});
