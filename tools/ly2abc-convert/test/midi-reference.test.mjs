import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findReferenceMidi,
  normalizeMidi2abc,
} from "../src/midi-reference.mjs";

test("finds one normalized sibling MIDI without duplicate parent matches", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "fnf-midi-reference-"));
  const directory = path.join(root, "work-lys");
  await mkdir(directory);
  const lilypond = path.join(directory, "work1-a4.ly");
  const midi = path.join(directory, "work1.mid");
  await writeFile(lilypond, "music", "utf8");
  await writeFile(midi, "MThd", "utf8");
  assert.equal(await findReferenceMidi(lilypond), midi);
});

test("normalizes midi2abc voices while retaining LilyPond metadata", () => {
  const midi = `X: 1
T: from input.mid
M: 2/2
L: 1/8
Q:1/4=54
K:E % 4 sharps
V:1
%%clef treble
V: split2A
K:C % split voice key
 C E G \\
 c |
V: split2B
K:C % split voice key
 z4 G4 |
V:2
%%MIDI program 0
 C,,4 G,,4 |
`;
  const lilypond = `X:1
T:Moonlight – Teil 1
C:Ludwig van Beethoven
N:Op. 27 No. 2
M:2/2
K:E
[V:RH] C`;
  const normalized = normalizeMidi2abc(midi, lilypond);
  assert.match(normalized, /^T:Moonlight$/mu);
  assert.match(normalized, /^C:Ludwig van Beethoven$/mu);
  assert.match(normalized, /^Q:1\/4=54$/mu);
  assert.match(normalized, /^K:E$/mu);
  assert.match(normalized, /^V:RH1 clef=treble$/mu);
  assert.match(normalized, /^V:RH2 clef=treble$/mu);
  assert.match(normalized, /^V:LH clef=bass$/mu);
  assert.match(normalized, /^\[V:RH1\] \[K:C\] C E G c \|$/mu);
  assert.match(normalized, /^\[V:RH2\] \[K:C\] z4 G4 \|$/mu);
  assert.doesNotMatch(normalized, /\(&|&\)/u);
  assert.doesNotMatch(normalized, /%%|\\/u);
});

test("keeps dense piano tracks as distinct playable voices", () => {
  const splitTrack = (parent, split, pitch) => `V:${parent}
${Array.from({ length: 5 }, (_, index) => `V: split${split}${String.fromCharCode(65 + index)}\n${pitch}8 |`).join("\n")}`;
  const midi = `X:1
M:4/4
L:1/8
Q:1/4=120
K:C
${splitTrack(1, 2, "C")}
${splitTrack(2, 3, "C,")}
`;
  const normalized = normalizeMidi2abc(
    midi,
    "X:1\nT:Dense piano score\nC:Composer\nK:C\nC",
  );
  assert.equal([...normalized.matchAll(/^V:/gmu)].length, 10);
  assert.match(normalized, /^V:RH5 clef=treble$/mu);
  assert.match(normalized, /^V:LH5 clef=bass$/mu);
  assert.doesNotMatch(normalized, /\(&|&\)/u);
});

test("rejects active-looking or unsupported midi2abc notation", () => {
  const midi = `X:1
M:4/4
L:1/8
Q:1/4=60
K:C
V:1
<script> C |
`;
  assert.throws(
    () => normalizeMidi2abc(midi, "X:1\nT:Safe\nC:Safe\nK:C\nC"),
    /unsupported notation/u,
  );
});
