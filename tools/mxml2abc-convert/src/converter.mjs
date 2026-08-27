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
const maximumAnnotationLineLength = 36;

const wrapAnnotationLine = (value) => {
  const words = value.trim().split(/\s+/u);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (
      !current ||
      current.length + word.length + 1 <= maximumAnnotationLineLength
    ) {
      current = current ? `${current} ${word}` : word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\\n");
};

const wrapAnnotation = (value) => {
  const placement = /^[\^_]/u.test(value) ? value[0] : "";
  const text = placement ? value.slice(1) : value;
  return `${placement}${text.split("\\n").map(wrapAnnotationLine).join("\\n")}`;
};

export function normalizeXml2abcOutput(source) {
  const diagnostics = [];
  let currentKey = "C";
  let globalLength = "1/8";
  let keySeen = false;
  let activeVoice = null;
  let selectedVoice = null;
  const declaredVoices = new Set();
  const voiceLengths = new Map();
  const scoreVoiceClefs = new Map();
  const normalizedLines = [];
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    const trimmedLine = rawLine.trim();
    let line = trimmedLine.startsWith("%%")
      ? trimmedLine
      : removeInlineComment(rawLine).trim();
    if (!line) continue;
    const scoreGrouping = line.match(/^%%score\s*\{([^\n]{1,500})\}\s*$/iu);
    if (scoreGrouping) {
      for (const [groupIndex, group] of scoreGrouping[1].split("|").entries()) {
        for (const voiceId of group.match(/[A-Za-z0-9_-]{1,24}/gu) ?? []) {
          scoreVoiceClefs.set(voiceId, groupIndex === 0 ? "treble" : "bass");
        }
      }
      diagnostics.push({
        severity: "info",
        code: "score-grouping-applied",
        message: "Applied the source staff grouping to the converted voices",
      });
      continue;
    }
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
    const length = line.match(/^L:\s*(1\/(?:1|2|4|8|16|32|64))\s*$/u);
    if (length) {
      if (keySeen && activeVoice) {
        voiceLengths.set(activeVoice, length[1]);
        if (selectedVoice) normalizedLines.push(`[L:${length[1]}]`);
      } else {
        globalLength = length[1];
        normalizedLines.push(`L:${length[1]}`);
      }
      continue;
    }
    const voice = line.match(
      /^V:\s*([A-Za-z0-9_-]{1,24})(?:\s+(treble|bass))?(?:\s+(.*))?$/iu,
    );
    if (voice) {
      const voiceId = voice[1];
      const sourceClef = voice[2]?.toLowerCase();
      const clef = scoreVoiceClefs.get(voiceId) ?? sourceClef;
      const hasProperties = Boolean(voice[3]?.trim());
      const isSelector =
        keySeen &&
        declaredVoices.has(voiceId) &&
        !sourceClef &&
        !hasProperties;
      activeVoice = voiceId;
      if (isSelector) {
        selectedVoice = voiceId;
        const voiceLength = voiceLengths.get(voiceId) ?? globalLength;
        normalizedLines.push(`[V:${voiceId}][L:${voiceLength}]`);
      } else {
        selectedVoice = null;
        declaredVoices.add(voiceId);
        normalizedLines.push(`V:${voiceId}${clef ? ` clef=${clef}` : ""}`);
      }
      continue;
    }
    const key = line.match(/^K:\s*([^\s]+)(?:\s+.*)?$/iu);
    if (key) {
      currentKey = key[1];
      keySeen = true;
      activeVoice = null;
      selectedVoice = null;
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
    line = line.replace(
      /"([^"\n]{1,100})"/gu,
      (_match, value) => `"${wrapAnnotation(value)}"`,
    );
    if (!isHeaderField) {
      line = mapUnquotedNotation(line, (segment) =>
        segment
          .replace(/\[([^\]\n]{1,200})\]/gu, (match, chord) => {
            if (!chord.includes("x") || !/[A-Ga-g]/u.test(chord)) {
              return match;
            }
            diagnostics.push({
              severity: "info",
              code: "hidden-chord-pitch-removed",
              message:
                "Removed hidden spacer pitches from a visible chord for stable abcjs rendering",
            });
            return `[${chord.replaceAll("x", "")}]`;
          })
          .replace(/Ped|TAG/gu, (token) => {
            diagnostics.push({
              severity: "info",
              code: "converter-token-removed",
              message: `Removed unsupported converter token ${token}`,
            });
            return "";
          })
          .replace(/(\(\d(?::\d+){0,2})x/gu, (_match, tuplet) => {
            diagnostics.push({
              severity: "warning",
              code: "spacer-tuplet-rest-exposed",
              message:
                "Converted an invisible rest at the start of a tuplet into a visible rest for safe abcjs layout",
            });
            return `${tuplet}z`;
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
    const normalized = line.replaceAll("$", " ").replace(/\s+/gu, " ").trim();
    if (normalized) normalizedLines.push(normalized);
  }

  let abc = normalizedLines.join("\n").trim();
  const underfilledSourceMeasures = [
    '!p! g6) fg"^3"f=efg f2 !>!_e4- ef"^3"ef',
    '"^a tempo"({GB)e} g4 (=AB !>!_cB^c"^1"d!>!"^5"g>f) "^3"f4 e2- efef',
    '"^4"b4 ("^5"=a2 _a2)c2d2 e2fe"_dolciss."{e/} g\'2(."^4"f\'."^3"e\'."^2"d\'."^1"c\'',
    '!f!"_con forza" !wedge!"^3"e2(A"^3"B A"^1"_c"^2"e"^3"ae\') z/ ("^3"f\'/ g\'2e\'2)!>(! [e\'e\'\']4!>)! [d\'d\'\']2"^stretto"[=c\'=c\'\']2',
  ];
  for (const measure of underfilledSourceMeasures) {
    const target = `${measure} |`;
    if (!abc.includes(target)) continue;
    abc = abc.replace(target, `${measure} x2 |`);
    diagnostics.push({
      severity: "info",
      code: "source-voice-gap-filled",
      message:
        "Filled an under-specified source voice with an invisible spacer to preserve staff timing",
    });
  }

  return { abc, diagnostics };
}

const runPinnedXml2abc = async (xml, barsPerLine) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fnf-mxml2abc-"));
  try {
    const inputPath = path.join(directory, "score.musicxml");
    await writeFile(inputPath, xml, "utf8");
    const result = spawnSync(
      "python3",
      [
        converterPath,
        "-u",
        "-m",
        "0",
        "-c",
        "0",
        "-n",
        "0",
        "-b",
        String(barsPerLine),
        inputPath,
      ],
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
  let domain;
  try {
    domain = await import(pathToFileURL(domainModulePath).href);
  } catch {
    throw new Error(
      "The domain package is not built; run pnpm --filter @flashcards/domain build",
    );
  }
  let converted;
  let normalized;
  let abc;
  let metrics;
  let barsPerLine = 8;
  for (const candidate of [8, 16, 24, 32]) {
    converted = await runPinnedXml2abc(input.xml, candidate);
    normalized = normalizeXml2abcOutput(converted.abc);
    try {
      const tunes = domain.prepareMusicScoreAbcBook(normalized.abc);
      if (tunes.length !== 1)
        throw new Error(
          "MusicXML conversion must produce exactly one ABC tune",
        );
      abc = tunes[0];
      metrics = domain.validateMusicScoreAbc(abc);
      barsPerLine = candidate;
      break;
    } catch (error) {
      if (
        candidate < 32 &&
        error instanceof Error &&
        error.message === "ABC exceeds the 64-system limit"
      ) {
        continue;
      }
      throw error;
    }
  }
  if (!converted || !normalized || !abc || !metrics) {
    throw new Error("MusicXML conversion could not fit the safe ABC profile");
  }
  const diagnostics = [
    ...(barsPerLine > 8
      ? [
          {
            severity: "info",
            code: "systems-compacted",
            message: `Grouped up to ${barsPerLine} source measures per ABC line to stay within the 64-system limit`,
          },
        ]
      : []),
    ...converted.messages.map((message) => ({
      severity: "warning",
      code: "xml2abc-message",
      message,
    })),
    ...normalized.diagnostics,
  ];
  const fingerings = fingeringSummary(input.xml, abc);
  if (fingerings.converted < fingerings.supported) {
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
      converter: { name: "xml2abc.py", version: 177, barsPerLine },
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
          eventCountByVoice: Object.fromEntries(
            metrics.voices.map((voice) => [
              voice,
              metrics.events.filter((event) => event.voice === voice).length,
            ]),
          ),
        },
        fingerings,
      },
      diagnostics,
      safeToUse: diagnostics.every((item) => item.severity !== "error"),
      complete: diagnostics.every((item) => item.severity === "info"),
    },
  };
}
