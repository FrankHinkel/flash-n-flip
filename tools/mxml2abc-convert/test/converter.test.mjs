import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { convertMusicXmlFile } from "../src/converter.mjs";
import { readMusicXmlInput } from "../src/source.mjs";

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Fingering fixture</work-title></work>
  <identification><creator type="composer">FnF Test</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration>
        <voice>1</voice><type>whole</type><staff>1</staff>
        <notations><technical><fingering placement="above">3</fingering></technical></notations>
      </note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration>
        <voice>2</voice><type>whole</type><staff>2</staff>
        <notations><technical><fingering placement="below">5</fingering></technical></notations>
      </note>
    </measure>
  </part>
</score-partwise>`;

const withTemporaryDirectory = async (callback) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fnf-mxml2abc-test-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test("converts a piano MusicXML file and preserves numeric fingerings", async () => {
  await withTemporaryDirectory(async (directory) => {
    const input = path.join(directory, "fingering.musicxml");
    await writeFile(input, fixture, "utf8");
    const converted = await convertMusicXmlFile(input);

    assert.match(converted.abc, /^T:Fingering fixture$/mu);
    assert.match(converted.abc, /\[V:1\]/u);
    assert.match(converted.abc, /\[V:2\]/u);
    assert.match(converted.abc, /"\^3"/u);
    assert.match(converted.abc, /"_5"/u);
    assert.deepEqual(converted.report.output.fingerings, {
      source: 2,
      supported: 2,
      converted: 2,
      discarded: 0,
    });
    assert.equal(converted.report.input.composer, "FnF Test");
    assert.deepEqual(converted.report.output.metrics.eventCountByVoice, {
      1: 1,
      2: 1,
    });
    assert.equal(converted.report.safeToUse, true);
  });
});

test("rejects MusicXML entities before invoking the converter", async () => {
  await withTemporaryDirectory(async (directory) => {
    const input = path.join(directory, "entity.musicxml");
    await writeFile(
      input,
      `<!DOCTYPE score-partwise [<!ENTITY x SYSTEM "file:///etc/passwd">]>${fixture}`,
      "utf8",
    );
    await assert.rejects(() => readMusicXmlInput(input), /entities|DTD/u);
  });
});

test("rejects an MXL container that declares a traversal path", async () => {
  await withTemporaryDirectory(async (directory) => {
    const input = path.join(directory, "unsafe.mxl");
    const script = `
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w") as archive:
    archive.writestr("META-INF/container.xml", """<?xml version="1.0"?><container><rootfiles><rootfile full-path="../score.musicxml"/></rootfiles></container>""")
    archive.writestr("score.musicxml", ${JSON.stringify(fixture)})
`;
    const zipped = spawnSync("python3", ["-c", script, input], {
      encoding: "utf8",
      shell: false,
    });
    assert.equal(zipped.status, 0, zipped.stderr);
    await assert.rejects(() => readMusicXmlInput(input), /safe MusicXML root/u);
  });
});
