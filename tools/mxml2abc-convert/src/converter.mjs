import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readMusicXmlInput } from "./source.mjs";

const toolDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const converterPath = path.join(toolDirectory, "vendor", "xml2abc.py");
const domainModulePath = path.resolve(
  toolDirectory,
  "..",
  "..",
  "packages",
  "domain",
  "dist",
  "music-score.js",
);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const textValue = (xml, name) => {
  const match = xml.match(
    new RegExp(`<${name}\\b[^>]*>([^<]{0,500})</${name}>`, "iu"),
  );
  return match?.[1]?.replace(/\s+/gu, " ").trim() || null;
};

const composerValue = (xml) => {
  const match = xml.match(
    /<creator\b[^>]*\btype\s*=\s*["']composer["'][^>]*>([^<]{0,500})<\/creator>/iu,
  );
  return match?.[1]?.replace(/\s+/gu, " ").trim() || null;
};

const removeInlineComment = (line) => {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') quoted = !quoted;
    else if (line[index] === "%" && !quoted)
      return line.slice(0, index).trimEnd();
  }
  return line;
};

const mapUnquotedNotation = (value, transform) => {
  let result = "";
  let cursor = 0;
  const protectedNotation =
    /(\[[A-Za-z]:[^\]\n]{0,100}\]|"[^"\n]{0,100}"|![^!\n]{1,60}!)/gu;
  for (const match of value.matchAll(protectedNotation)) {
    result += transform(value.slice(cursor, match.index));
    result += match[0];
    cursor = match.index + match[0].length;
  }
  return result + transform(value.slice(cursor));
};

const safeDecoration = /^[A-Za-z][A-Za-z0-9_.+-]{0,30}$/u;
const inertDecoration = /^[<>()[\]/]+$/u;

export function normalizeXml2abcOutput(source) {
  const diagnostics = [];
  let currentKey = "C";
  const normalizedLines = [];
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    let line = removeInlineComment(rawLine).trim();
    if (!line) continue;
    if (line.startsWith("%%")) {
      diagnostics.push({
        severity: "info",
        code: "directive-removed",
        message: `Removed inert converter directive ${line.split(/\s+/u)[0]}`,
      });
      continue;
    }
    if (/^[IZU]:/u.test(line)) {
      diagnostics.push({
        severity: "info",
        code: "field-removed",
        message: `Removed unsupported ${line[0]}: field`,
      });
      continue;
    }
    const tempo = line.match(
      /^Q:\s*(\d+)\/(1|2|4|8|16|32|64)\s*=\s*(\d{1,3})\s*$/u,
    );
    if (tempo) {
      const beatsPerMinute = Number(tempo[1]) * Number(tempo[3]);
      if (beatsPerMinute >= 20 && beatsPerMinute <= 350) {
        normalizedLines.push(`Q:1/${tempo[2]}=${beatsPerMinute}`);
      } else {
        diagnostics.push({
          severity: "warning",
          code: "tempo-removed",
          message: `Removed unsupported tempo ${line.slice(2).trim()}`,
        });
      }
      continue;
    }
    const voice = line.match(
      /^V:\s*([A-Za-z0-9_-]{1,24})(?:\s+(treble|bass))?(?:\s+.*)?$/iu,
    );
    if (voice) {
      normalizedLines.push(
        `V:${voice[1]}${voice[2] ? ` clef=${voice[2].toLowerCase()}` : ""}`,
      );
      continue;
    }
    const key = line.match(/^K:\s*([^\s]+)(?:\s+.*)?$/iu);
    if (key) {
      currentKey = key[1];
      normalizedLines.push(`K:${currentKey}`);
      continue;
    }
    const isHeaderField = /^[A-Za-z]:/u.test(line);
    line = line.replace(
      /\[K:\s*(treble|bass)\s*\]/giu,
      (_match, clef) => `[K:${currentKey} clef=${String(clef).toLowerCase()}]`,
    );
    line = line.replace(
      /\[K:\s*([A-G](?:b|#)?(?:min|m|mix|dor|phr|lyd|loc)?)\s+(?:clef=)?(treble|bass)(?:[+-]8)?(?:\s+[^\]]*)?\]/giu,
      (_match, keyName, clef) => {
        currentKey = keyName;
        return `[K:${keyName} clef=${String(clef).toLowerCase()}]`;
      },
    );
    line = line.replace(
      /\[K:\s*([A-G](?:b|#)?(?:min|m|mix|dor|phr|lyd|loc)?)\s*\]/giu,
      (match, keyName) => {
        currentKey = keyName;
        return match;
      },
    );
    line = line.replace(
      /\[Q:\s*(\d+)\/(1|2|4|8|16|32|64)\s*=\s*(\d{1,3})\s*\]/gu,
      (match, numerator, denominator, value) => {
        const beatsPerMinute = Number(numerator) * Number(value);
        if (beatsPerMinute >= 20 && beatsPerMinute <= 350)
          return `[Q:1/${denominator}=${beatsPerMinute}]`;
        diagnostics.push({
          severity: "warning",
          code: "inline-tempo-removed",
          message: `Removed unsupported inline tempo ${match.slice(3, -1).trim()}`,
        });
        return "";
      },
    );
    line = line.replace(/\[I:[^\]\n]{1,80}\]/gu, (field) => {
      diagnostics.push({
        severity: "info",
        code: "inline-instruction-removed",
        message: `Removed unsupported inline instruction ${field}`,
      });
      return "";
    });
    line = line.replace(/!([^!\n]{1,60})!/gu, (match, name) => {
      if (safeDecoration.test(name) || inertDecoration.test(name)) return match;
      diagnostics.push({
        severity: "warning",
        code: "decoration-removed",
        message: `Removed unsupported ABC decoration ${name}`,
      });
      return "";
    });
    if (!isHeaderField) {
      line = mapUnquotedNotation(line, (segment) =>
        segment
          .replace(/Ped|TAG/gu, (token) => {
            diagnostics.push({
              severity: "info",
              code: "converter-token-removed",
              message: `Removed unsupported converter token ${token}`,
            });
            return "";
          })
          .replace(/[H-WYh-wy]/gu, (character) => {
            diagnostics.push({
              severity: "warning",
              code: "notation-character-removed",
              message: `Removed unsupported notation character ${character}`,
            });
            return "";
          }),
      );
    }
    line = line.replaceAll("$", " ").replace(/\s+/gu, " ").trim();
    if (line) normalizedLines.push(line);
  }

  const compact = [];
  let body = [];
  const flushBody = () => {
    if (body.length) compact.push(body.join(" "));
    body = [];
  };
  for (const line of normalizedLines) {
    if (/^[A-Za-z]:/u.test(line)) {
      flushBody();
      compact.push(line);
    } else body.push(line);
  }
  flushBody();
  return { abc: compact.join("\n").trim(), diagnostics };
}

const runPinnedXml2abc = async (xml) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fnf-mxml2abc-"));
  try {
    const inputPath = path.join(directory, "score.musicxml");
    await writeFile(inputPath, xml, "utf8");
    const result = spawnSync(
      "python3",
      [converterPath, "-m", "0", "-c", "0", "-x", inputPath],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024,
        shell: false,
      },
    );
    if (result.error)
      throw new Error(`Pinned xml2abc could not run: ${result.error.message}`);
    if (result.status !== 0)
      throw new Error(
        `Pinned xml2abc failed with exit code ${result.status}: ${(result.stderr || result.stdout).trim()}`,
      );
    const abc = result.stdout;
    const messages = result.stderr
      .split("\n")
      .map((value) => value.trim())
      .filter(
        (value) => value && !/\.abc written with \d+ voices$/u.test(value),
      );
    return { abc, messages };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const fingeringSummary = (xml, abc) => {
  const source = [
    ...xml.matchAll(/<fingering\b([^>]*)>([^<]*)<\/fingering>/giu),
  ];
  const supported = source.filter((match) =>
    /^[1-5](?:\s*[-–]\s*[1-5])?$/u.test(match[2].trim()),
  );
  const converted = [
    ...abc.matchAll(/"[\^_](?:\([1-5](?:-[1-5])?\)|[1-5](?:-[1-5])?)"/gu),
  ].length;
  return {
    source: source.length,
    supported: supported.length,
    converted,
    discarded: source.length - supported.length,
  };
};

export async function convertMusicXmlFile(inputFile) {
  const input = await readMusicXmlInput(inputFile);
  const converted = await runPinnedXml2abc(input.xml);
  const normalized = normalizeXml2abcOutput(converted.abc);
  let domain;
  try {
    domain = await import(pathToFileURL(domainModulePath).href);
  } catch {
    throw new Error(
      "The domain package is not built; run pnpm --filter @flashcards/domain build",
    );
  }
  const tunes = domain.prepareMusicScoreAbcBook(normalized.abc);
  if (tunes.length !== 1)
    throw new Error("MusicXML conversion must produce exactly one ABC tune");
  const abc = tunes[0];
  const metrics = domain.validateMusicScoreAbc(abc);
  const diagnostics = [
    ...converted.messages.map((message) => ({
      severity: "warning",
      code: "xml2abc-message",
      message,
    })),
    ...normalized.diagnostics,
  ];
  const fingerings = fingeringSummary(input.xml, abc);
  if (fingerings.converted !== fingerings.supported) {
    diagnostics.push({
      severity: "warning",
      code: "fingering-count-mismatch",
      message: `Converted ${fingerings.converted} of ${fingerings.supported} supported fingerings`,
    });
  }
  return {
    abc,
    report: {
      format: "flash-n-flip.mxml2abc-report",
      formatVersion: 1,
      converter: { name: "xml2abc.py", version: 177 },
      input: {
        file: path.basename(input.inputPath),
        type: input.inputType,
        rootPath: input.rootPath,
        byteSize: input.sourceBuffer.length,
        sha256: sha256(input.sourceBuffer),
        title:
          textValue(input.xml, "work-title") ??
          textValue(input.xml, "movement-title"),
        composer: composerValue(input.xml),
        rights: textValue(input.xml, "rights"),
      },
      output: {
        byteSize: Buffer.byteLength(abc, "utf8"),
        sha256: sha256(abc),
        metrics: {
          eventCount: metrics.eventCount,
          measureCount: metrics.measureCount,
          systemCount: metrics.systemCount,
          voices: metrics.voices,
          voiceClefs: metrics.voiceClefs,
        },
        fingerings,
      },
      diagnostics,
      safeToUse: diagnostics.every((item) => item.severity !== "error"),
      complete: diagnostics.every((item) => item.severity === "info"),
    },
  };
}
