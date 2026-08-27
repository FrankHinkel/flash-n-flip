import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { convertMusicXmlFile } from "../src/converter.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const sourceDirectory = path.join(
  root,
  "examples",
  "music",
  "musicxml",
  "sources",
);
const expectedHashes = new Map([
  [
    "bach-prelude-bwv-846.mxl",
    "286535dfb99cf841bfa9848e4cd71ddb2339c476a123971cb326b3d85e410018",
  ],
  [
    "beethoven-fuer-elise.musicxml",
    "f665fc5d0c8ad5c96e7e099a4bf927756d1087ea5a58d0d85816c2e8c3530f5c",
  ],
  [
    "beethoven-moonlight-sonata-1.mxl",
    "720157f962523207a783d40e5c6573a131f943b38b73bd563f695a05bc3a4f78",
  ],
  [
    "chopin-nocturne-op-9-no-2.mxl",
    "271cb6b0be8bad3f784bad4ea30fba26848f929d257b47ec9b43a77d39bc7969",
  ],
  [
    "debussy-clair-de-lune.mxl",
    "47bb4b35ec35f79eeaa2b9858c6b413793bdcc1317d3983e001d245e3e67939d",
  ],
  [
    "joplin-maple-leaf-rag.mxl",
    "5fe979be991095d18bb9ee3394bf70d26237e37903ab7e751ee32e30b8e6460a",
  ],
  [
    "joplin-the-entertainer.mxl",
    "e11fc1386747c1dd5d1ca352b65da23653d15d241aee17a2f42354c14f61eba7",
  ],
  [
    "mozart-rondo-alla-turca.mxl",
    "897cf71bf9728163316cb46cffa1dadfd7da5dbadcfbe8d22cac80ddee50390a",
  ],
  [
    "rimsky-korsakov-flight-of-the-bumblebee.mxl",
    "05e65c9bd597f9e60996066beec6b1a775ed1e0d635e7c811dfb116657ea1a51",
  ],
  [
    "satie-gymnopedie-no-1.mxl",
    "dc0191ae303450692632fa60aec1b10b2528a0bab54159e530911ed2e8eeaafe",
  ],
]);

const expectedMeasures = new Map([
  ["bach-prelude-bwv-846.mxl", 34],
  ["beethoven-fuer-elise.musicxml", 108],
  ["beethoven-moonlight-sonata-1.mxl", 69],
  ["chopin-nocturne-op-9-no-2.mxl", 38],
  ["debussy-clair-de-lune.mxl", 74],
  ["joplin-maple-leaf-rag.mxl", 86],
  ["joplin-the-entertainer.mxl", 94],
  ["mozart-rondo-alla-turca.mxl", 131],
  ["rimsky-korsakov-flight-of-the-bumblebee.mxl", 101],
  ["satie-gymnopedie-no-1.mxl", 47],
]);

const expectedRepeatMarkers = new Map([
  ["beethoven-fuer-elise.musicxml", 8],
  ["joplin-maple-leaf-rag.mxl", 24],
  ["joplin-the-entertainer.mxl", 32],
  ["mozart-rondo-alla-turca.mxl", 6],
  ["satie-gymnopedie-no-1.mxl", 4],
]);

test("all ten reference scores convert into the FnF-safe ABC subset", async () => {
  const files = (await readdir(sourceDirectory)).sort();
  assert.equal(files.length, 10);

  for (const file of files) {
    const inputPath = path.join(sourceDirectory, file);
    const hash = createHash("sha256")
      .update(await readFile(inputPath))
      .digest("hex");
    assert.equal(hash, expectedHashes.get(file), file);
    const converted = await convertMusicXmlFile(inputPath);
    assert.equal(converted.report.safeToUse, true, file);
    assert.ok(converted.report.output.metrics.eventCount > 0, file);
    assert.equal(
      converted.report.output.metrics.measureCount,
      expectedMeasures.get(file),
      file,
    );
    assert.equal(
      converted.abc.match(/\|:|:\|/gu)?.length ?? 0,
      expectedRepeatMarkers.get(file) ?? 0,
      file,
    );
    assert.ok(converted.abc.startsWith("X:1\n"), file);
  }
});

test("fingered corpus editions retain every supported numeric fingering", async () => {
  for (const file of [
    "chopin-nocturne-op-9-no-2.mxl",
    "mozart-rondo-alla-turca.mxl",
  ]) {
    const converted = await convertMusicXmlFile(
      path.join(sourceDirectory, file),
    );
    const fingerings = converted.report.output.fingerings;
    assert.ok(fingerings.supported > 0, file);
    assert.equal(fingerings.converted, fingerings.supported, file);
    assert.equal(fingerings.discarded, 0, file);
  }
});

test("Moonlight Sonata keeps four populated voices and their local lengths", async () => {
  const converted = await convertMusicXmlFile(
    path.join(sourceDirectory, "beethoven-moonlight-sonata-1.mxl"),
  );
  const checkedInScore = await readFile(
    path.join(
      root,
      "examples",
      "music",
      "musicxml",
      "generated",
      "beethoven-moonlight-sonata-1.abc",
    ),
    "utf8",
  );

  assert.equal(checkedInScore.trimEnd(), converted.abc);
  assert.deepEqual(converted.report.output.metrics.eventCountByVoice, {
    1: 399,
    2: 250,
    3: 570,
    4: 70,
  });
  assert.equal(converted.report.output.metrics.measureCount, 69);
  assert.equal(converted.report.output.metrics.systemCount, 40);
  assert.equal(converted.abc.split("\n").length, 52);
  assert.ok(
    Math.max(...converted.abc.split("\n").map((line) => line.length)) < 400,
  );
  assert.doesNotMatch(converted.abc, /\(\d(?::\d+){0,2}x/u);
  assert.equal(
    converted.report.diagnostics.filter(
      ({ code }) => code === "spacer-tuplet-rest-exposed",
    ).length,
    1,
  );
  assert.match(converted.abc, /\[V:1\]\[L:1\/8\]/u);
  assert.match(converted.abc, /\[V:2\]\[L:1\/4\]/u);
  assert.match(converted.abc, /\[V:3\]\[L:1\/8\]/u);
  assert.match(converted.abc, /\[V:4\]\[L:1\/4\]/u);
  assert.match(
    converted.abc,
    /Si deve suonare tutto questo pezzo\\ndelicatissimamente/u,
  );
  assert.ok(
    converted.abc.match(/"[^"\n]+"/gu)?.every((annotation) =>
      annotation
        .slice(1, -1)
        .split("\\n")
        .every((line) => line.replace(/^[\^_]/u, "").length <= 36),
    ),
  );
});

test("complex piano sources retain their staff grouping and repaired timing", async () => {
  const debussy = await convertMusicXmlFile(
    path.join(sourceDirectory, "debussy-clair-de-lune.mxl"),
  );
  assert.deepEqual(debussy.report.output.metrics.voiceClefs, {
    1: "treble",
    2: "bass",
    3: "bass",
    4: "treble",
    5: "bass",
    6: "treble",
  });

  const chopin = await convertMusicXmlFile(
    path.join(sourceDirectory, "chopin-nocturne-op-9-no-2.mxl"),
  );
  assert.equal(
    chopin.report.diagnostics.filter(
      ({ code }) => code === "source-voice-gap-filled",
    ).length,
    4,
  );
});
