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
 C E G \\
 c |
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
  assert.match(normalized, /^V:RH clef=treble$/mu);
  assert.match(normalized, /^V:LH clef=bass$/mu);
  assert.match(normalized, /^\[V:RH\] C E G c \|$/mu);
  assert.doesNotMatch(normalized, /%%|\\/u);
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
