import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const maximumMidiBytes = 2 * 1024 * 1024;
const maximumMidi2abcOutput = 2 * 1024 * 1024;
const maximumMidiArchiveBytes = 8 * 1024 * 1024;

const normalizedStem = (file) =>
  path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/(?:-a4|-let)$/u, "")
    .replace(/[^a-z0-9]+/gu, "");

async function midiFilesIn(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const direct = entries
    .filter((entry) => entry.isFile() && /\.(?:mid|midi)$/iu.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
  const nested = [];
  for (const entry of entries.slice(0, 128)) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    let children;
    try {
      children = await readdir(child, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of children.slice(0, 128)) {
      if (file.isFile() && /\.(?:mid|midi)$/iu.test(file.name))
        nested.push(path.join(child, file.name));
    }
  }
  return [...direct, ...nested];
}

export async function findReferenceMidi(inputFile) {
  const input = path.resolve(inputFile);
  const target = normalizedStem(input);
  const candidates = [
    ...new Set([
      ...(await midiFilesIn(path.dirname(input))),
      ...(await midiFilesIn(path.dirname(path.dirname(input)))),
    ]),
  ];
  const exact = candidates.filter(
    (candidate) => normalizedStem(candidate) === target,
  );
  return exact.length === 1 ? exact[0] : null;
}

export async function assertSafeMidiFile(midiFile) {
  if (!/\.(?:mid|midi)$/iu.test(midiFile))
    throw new Error("Reference MIDI must have the .mid or .midi extension");
  const info = await stat(midiFile);
  if (!info.isFile() || info.size < 14 || info.size > maximumMidiBytes)
    throw new Error("Reference MIDI is empty, oversized or not a regular file");
  assertSafeMidiBuffer(await readFile(midiFile));
}

function assertSafeMidiBuffer(buffer) {
  if (
    buffer.length < 14 ||
    buffer.length > maximumMidiBytes ||
    buffer.subarray(0, 4).toString("ascii") !== "MThd"
  )
    throw new Error("Reference MIDI is invalid or oversized");
}

async function findArchivedReferenceMidi(inputFile) {
  const parent = path.dirname(path.dirname(path.resolve(inputFile)));
  const target = normalizedStem(inputFile);
  let entries;
  try {
    entries = await readdir(parent, { withFileTypes: true });
  } catch {
    return null;
  }
  const matches = [];
  for (const entry of entries.slice(0, 128)) {
    if (!entry.isFile() || !/-mids\.zip$/iu.test(entry.name)) continue;
    const archive = path.join(parent, entry.name);
    const archiveInfo = await stat(archive);
    if (archiveInfo.size > maximumMidiArchiveBytes) continue;
    const listing = spawnSync("unzip", ["-Z1", archive], {
      encoding: "utf8",
      shell: false,
      timeout: 5_000,
      maxBuffer: 256 * 1024,
      windowsHide: true,
    });
    if (listing.status !== 0 || listing.error) continue;
    for (const name of listing.stdout.split("\n")) {
      if (
        !name ||
        name.startsWith("/") ||
        name.split("/").includes("..") ||
        !/\.(?:mid|midi)$/iu.test(name) ||
        normalizedStem(name) !== target
      )
        continue;
      matches.push({ archive, name });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

export async function prepareReferenceMidi(inputFile, explicitMidi) {
  const direct = explicitMidi ?? (await findReferenceMidi(inputFile));
  if (direct) {
    await assertSafeMidiFile(direct);
    return {
      path: path.resolve(direct),
      label: path.basename(direct),
      cleanup: async () => {},
    };
  }
  const archived = await findArchivedReferenceMidi(inputFile);
  if (!archived) return null;
  const extracted = spawnSync(
    "unzip",
    ["-p", archived.archive, archived.name],
    {
      encoding: null,
      shell: false,
      timeout: 5_000,
      maxBuffer: maximumMidiBytes,
      windowsHide: true,
    },
  );
  if (extracted.status !== 0 || extracted.error)
    throw new Error("Matching MIDI could not be read safely from its archive");
  assertSafeMidiBuffer(extracted.stdout);
  const directory = await mkdtemp(path.join(tmpdir(), "fnf-ly2abc-midi-"));
  const temporaryMidi = path.join(directory, path.basename(archived.name));
  await writeFile(temporaryMidi, extracted.stdout);
  return {
    path: temporaryMidi,
    label: `${path.basename(archived.archive)}:${archived.name}`,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

export function runMidi2abc(midiFile) {
  const result = spawnSync("midi2abc", [midiFile], {
    encoding: "utf8",
    shell: false,
    timeout: 10_000,
    maxBuffer: maximumMidi2abcOutput,
    windowsHide: true,
  });
  if (result.error?.code === "ENOENT")
    throw new Error("midi2abc is required for MIDI-verified conversion");
  if (result.error) throw new Error(`midi2abc failed: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(
      `midi2abc failed with exit code ${result.status}: ${result.stderr.trim()}`,
    );
  if (!result.stdout || result.stdout.length > maximumMidi2abcOutput)
    throw new Error("midi2abc returned empty or oversized output");
  return result.stdout;
}

const headerValue = (abc, field, fallback = "") =>
  abc.match(new RegExp(`^${field}:\\s*(.+)$`, "mu"))?.[1]?.trim() ?? fallback;

export function normalizeMidi2abc(midiAbc, lilypondAbc) {
  const sourceLines = midiAbc.replaceAll("\r\n", "\n").split("\n");
  const keyIndex = sourceLines.findIndex((line) => /^K:\s*/u.test(line));
  if (keyIndex < 0) throw new Error("midi2abc output has no key field");
  const voices = [];
  let current;
  for (const rawLine of sourceLines.slice(keyIndex + 1)) {
    const voice = rawLine.match(/^V:\s*([A-Za-z0-9_-]{1,24})\s*$/u);
    if (voice) {
      current = { sourceId: voice[1], lines: [] };
      voices.push(current);
      continue;
    }
    if (!current || /^%%/u.test(rawLine.trim())) continue;
    const safeLine = rawLine
      .replace(/\\\s*$/u, "")
      .replace(/\s+%.*$/u, "")
      .trim();
    if (safeLine) current.lines.push(safeLine);
  }
  if (voices.length === 0 || voices.length > 6)
    throw new Error("midi2abc output has no supported voice layout");
  for (const voice of voices) {
    const body = voice.lines.join(" ");
    if (
      body.length === 0 ||
      !/^[A-Ga-gxzXZ0-9^_=,/'|:()[\]{}.!+<>~&\-\s]*$/u.test(body)
    )
      throw new Error("midi2abc output contains unsupported notation");
  }

  const ids = voices.map((_, index) => {
    if (voices.length === 1) return "RH";
    if (voices.length === 2) return index === 0 ? "RH" : "LH";
    return index < Math.ceil(voices.length / 2)
      ? `RH${index + 1}`
      : `LH${index + 1 - Math.ceil(voices.length / 2)}`;
  });
  const lilypondTitle = headerValue(
    lilypondAbc,
    "T",
    "Untitled LilyPond import",
  ).replace(/\s+–\s+Teil\s+\d+$/u, "");
  const lilypondComposer = headerValue(lilypondAbc, "C", "Unknown composer");
  const lilypondOpus = headerValue(lilypondAbc, "N");
  const meter = headerValue(midiAbc, "M", headerValue(lilypondAbc, "M", "4/4"));
  const unit = headerValue(midiAbc, "L", "1/8");
  const tempo = headerValue(midiAbc, "Q", "1/4=60");
  const key = headerValue(midiAbc, "K", "C").replace(/\s+%.*$/u, "");
  if (!/^(?:none|HP|[A-G](?:b|#)?m?)$/u.test(key))
    throw new Error("midi2abc output contains an unsupported key");
  if (!/^(?:C\||C|\d{1,2}\/\d{1,2})$/u.test(meter))
    throw new Error("midi2abc output contains an unsupported meter");
  if (!/^1\/(?:1|2|4|8|16|32|64)$/u.test(unit))
    throw new Error("midi2abc output contains an unsupported unit length");
  if (!/^(?:1\/(?:1|2|4|8|16|32|64)=)?\d{2,3}$/u.test(tempo))
    throw new Error("midi2abc output contains an unsupported tempo");
  const lines = [
    "X:1",
    `T:${lilypondTitle}`,
    `C:${lilypondComposer}`,
    ...(lilypondOpus ? [`N:${lilypondOpus}`] : []),
    `M:${meter}`,
    `L:${unit}`,
    `Q:${tempo}`,
    `K:${key}`,
    ...voices.map(
      (_, index) =>
        `V:${ids[index]} clef=${index < Math.ceil(voices.length / 2) ? "treble" : "bass"}`,
    ),
    ...voices.map(
      (voice, index) => `[V:${ids[index]}] ${voice.lines.join(" ")}`,
    ),
  ];
  const normalized = lines.join("\n");
  if (normalized.length > 150_000)
    throw new Error("MIDI-derived ABC exceeds the Flash-n-Flip size limit");
  return normalized;
}

export const midiReferenceLimits = Object.freeze({
  bytes: maximumMidiBytes,
  output: maximumMidi2abcOutput,
});
