#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const soundfontOutput = path.join(
  repositoryRoot,
  "apps/web/public/soundfonts/fnf-upright-piano/acoustic_grand_piano-mp3",
);
export const sourceArchiveSha256 =
  "e346ef198fcda0694fc66ddb80c2db2a1c700e96e3a1801930e3cebfed37047f";
export const sourceUrl =
  "https://freepats.zenvoid.org/Piano/UprightPianoKW/UprightPianoKW-small-SFZ%2BFLAC-20190703.7z";

const noteNames = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

export function midiNoteName(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new Error(`Invalid MIDI note ${midi}`);
  }
  return `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function parseSfzRegions(source) {
  const regions = [];
  for (const part of source.split(/<region>/u).slice(1)) {
    const value = (name) =>
      part.match(new RegExp(`(?:^|\\n)\\s*${name}=([^\\s]+)`, "u"))?.[1];
    const low = Number(value("lokey"));
    const high = Number(value("hikey"));
    const center = Number(value("pitch_keycenter"));
    const sample = value("sample");
    if (![low, high, center].every(Number.isInteger) || !sample) {
      throw new Error("The source SFZ contains an incomplete region");
    }
    regions.push({ low, high, center, sample });
  }
  if (!regions.length) throw new Error("The source SFZ contains no regions");
  return regions;
}

const sha256File = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export function generateManifest(directory) {
  const files = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".mp3"))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      byteSize: fs.statSync(path.join(directory, name)).size,
      sha256: sha256File(path.join(directory, name)),
    }));
  return {
    schemaVersion: 1,
    source: {
      title: "FreePats Upright piano KW (small)",
      version: "2019-07-03",
      url: sourceUrl,
      archiveSha256: sourceArchiveSha256,
      dedication: "CC0-1.0",
    },
    conversion: {
      output: "mono MP3, 64 kbit/s, 44.1 kHz",
      pitchMapping: "SFZ region pitch_keycenter mapped to MIDI 21-108",
      command: "ffmpeg asetrate + aresample + alimiter + libmp3lame",
    },
    files,
  };
}

export function verifyGeneratedSoundfont(directory = soundfontOutput) {
  const manifestPath = path.join(path.dirname(directory), "manifest.json");
  const expected = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const actual = generateManifest(directory);
  if (
    actual.files.length !== 88 ||
    JSON.stringify(actual) !== JSON.stringify(expected)
  ) {
    throw new Error(
      "The checked-in local piano soundfont does not match its manifest",
    );
  }
}

function generate(sourceDirectory) {
  const sfzPath = path.join(
    sourceDirectory,
    "UprightPianoKW-small-20190703.sfz",
  );
  const samplesDirectory = path.join(sourceDirectory, "samples");
  if (!fs.existsSync(path.join(sourceDirectory, "cc0.txt"))) {
    throw new Error(
      "The FreePats CC0 notice is missing from the source directory",
    );
  }
  const regions = parseSfzRegions(fs.readFileSync(sfzPath, "utf8"));
  fs.mkdirSync(soundfontOutput, { recursive: true });
  for (let midi = 21; midi <= 108; midi += 1) {
    const region = regions.find(({ low, high }) => midi >= low && midi <= high);
    if (!region)
      throw new Error(`No SFZ source region covers MIDI note ${midi}`);
    const input = path.join(
      samplesDirectory,
      region.sample.replace(/^samples\//u, ""),
    );
    const output = path.join(soundfontOutput, `${midiNoteName(midi)}.mp3`);
    const ratio = 2 ** ((midi - region.center) / 12);
    const result = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-af",
        `asetrate=44100*${ratio.toFixed(12)},aresample=44100,alimiter=limit=0.95`,
        "-ac",
        "1",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "64k",
        output,
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(
        `ffmpeg failed for ${midiNoteName(midi)}: ${result.stderr}`,
      );
    }
  }
  const manifest = generateManifest(soundfontOutput);
  const manifestPath = path.join(
    path.dirname(soundfontOutput),
    "manifest.json",
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  verifyGeneratedSoundfont();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.includes("--check")) {
    verifyGeneratedSoundfont();
  } else {
    const sourceDirectory = process.argv[2];
    if (!sourceDirectory) {
      throw new Error(
        "Usage: node scripts/generate-music-soundfont.mjs <extracted-source-directory>",
      );
    }
    generate(path.resolve(sourceDirectory));
  }
}
