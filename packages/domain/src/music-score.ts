import { z } from "zod";

export const musicScoreStaffScales = ["small", "normal", "large"] as const;
export type MusicScoreStaffScale = (typeof musicScoreStaffScales)[number];
export const musicScoreKeyboardModes = ["off", "keys", "notes"] as const;
export type MusicScoreKeyboardMode = (typeof musicScoreKeyboardModes)[number];

export type MusicScoreEvent = {
  index: number;
  measure: number;
  voice: string;
  kind: "note" | "rest";
  value: string;
  sourceRange: { start: number; end: number };
};

export type MusicScoreMetrics = {
  eventCount: number;
  measureCount: number;
  systemCount: number;
  lyricSyllableCount: number;
  voices: string[];
  voiceClefs: Record<string, "treble" | "bass">;
  keySignature: string;
  meter?: string;
  clef: "treble" | "bass";
  tempo?: number;
  events: MusicScoreEvent[];
};

const maximumSourceLength = 30_000;
const maximumLines = 1_000;
const maximumSystems = 16;
const maximumMeasures = 128;
const maximumEvents = 2_000;
const maximumLyricSyllables = 200;
const allowedFields = new Set(["X", "T", "M", "L", "Q", "K", "V", "w"]);
const allowedInlineFields = new Set(["M", "L", "Q", "K", "V"]);
const allowedMusicCharacters = new Set(
  "ABCDEFGabcdefgxzXZ0123456789^_=,/'|:[](){}.!+<>~&- ".split(""),
);
const activeContentPattern =
  /<\s*\/?\s*(?:script|style|iframe|object|embed|form|link|svg|foreignObject)\b|\bon[a-z][a-z0-9_-]*\s*=|(?:javascript|data|file|https?|ftp):|(?:^|[\s"'])\.{0,2}[\\/]|\burl\s*\(|@import|expression\s*\(/iu;

const safeText = (value: string, maximum: number): boolean =>
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) &&
  !activeContentPattern.test(value);

const validKey = (value: string): boolean =>
  /^(?:none|HP|[A-G](?:b|#)?(?:m|mix|dor|phr|lyd|loc)?)(?:\s+(?:clef=)?(?:treble|bass)(?:[+-]8)?)?$/i.test(
    value.trim(),
  );

const validMeter = (value: string): boolean =>
  /^(?:none|C\||C|\d{1,2}\/\d{1,2})$/i.test(value.trim());

const validLength = (value: string): boolean =>
  /^1\/(?:1|2|4|8|16|32|64)$/.test(value.trim());

const tempoFromValue = (value: string): number | null => {
  const match = value.trim().match(/^(?:1\/(?:1|2|4|8|16|32|64)=)?(\d{2,3})$/);
  if (!match) return null;
  const tempo = Number(match[1]);
  return tempo >= 20 && tempo <= 350 ? tempo : null;
};

const voiceFromValue = (
  value: string,
): { id: string; clef?: "treble" | "bass" } | null => {
  const match = value
    .trim()
    .match(/^([A-Za-z0-9_-]{1,24})(?:\s+clef=(treble|bass))?$/i);
  if (!match) return null;
  return {
    id: match[1]!,
    clef: match[2]?.toLowerCase() as "treble" | "bass" | undefined,
  };
};

const withoutEmbeddedText = (value: string): string =>
  value
    .replace(/\[[A-Za-z]:\s*[^\]]*\]/gu, (match) => " ".repeat(match.length))
    .replace(/"[^"\n]{0,100}"/gu, (match) => " ".repeat(match.length))
    .replace(/![A-Za-z][A-Za-z0-9_.+-]{0,30}!/gu, (match) =>
      " ".repeat(match.length),
    );

const validateMusicBody = (value: string): void => {
  for (const match of value.matchAll(/"([^"\n]{0,100})"/gu)) {
    if (!safeText(match[1]!, 100) || /[<>&]/u.test(match[1]!)) {
      throw new Error("ABC chord text contains unsupported content");
    }
  }
  const body = withoutEmbeddedText(value);
  if (
    ![...body].every(
      (character) =>
        character === "\t" || allowedMusicCharacters.has(character),
    )
  ) {
    throw new Error("ABC music contains unsupported notation characters");
  }
};

const clefFromKey = (value: string): "treble" | "bass" =>
  /(?:^|\s)(?:clef=)?bass(?:[+-]8)?$/i.test(value.trim()) ? "bass" : "treble";

const eventPattern =
  /(?:\^\^|__|\^|_|=)?(?:[A-Ga-g][',]*|[xzXZ])(?:\d+|\/\d*)?\.?/gu;

export function normalizeMusicScoreAbc(source: string): string {
  return source.replaceAll("\r\n", "\n").trim();
}

export function validateMusicScoreAbc(sourceValue: string): MusicScoreMetrics {
  const source = normalizeMusicScoreAbc(sourceValue);
  if (!safeText(source, maximumSourceLength) || source.includes("\r")) {
    throw new Error("ABC source must contain 1 to 30,000 safe characters");
  }
  const lines = source.split("\n");
  if (lines.length > maximumLines)
    throw new Error("ABC source has too many lines");

  let referenceCount = 0;
  let hasKey = false;
  let titleCount = 0;
  let keySignature = "";
  let meter: string | undefined;
  let tempo: number | undefined;
  let clef: "treble" | "bass" = "treble";
  let lyricSyllableCount = 0;
  let currentVoice = "default";
  let systemCount = 0;
  const voices = new Set<string>();
  const voiceClefs: Record<string, "treble" | "bass"> = {};
  const currentMeasureByVoice = new Map<string, number>([["default", 1]]);
  const events: MusicScoreEvent[] = [];
  let cursor = 0;

  for (const rawLine of lines) {
    const lineStart = cursor;
    cursor += rawLine.length + 1;
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("%") || line.includes("%%")) {
      throw new Error("ABC directives and comments are not supported");
    }

    const field = line.match(/^([A-Za-z]):\s*(.*)$/u);
    if (field) {
      const name = field[1]!;
      const value = field[2]!.trim();
      if (
        !allowedFields.has(name) ||
        !safeText(value, name === "w" ? 5_000 : 500) ||
        /[<>&]/u.test(value)
      ) {
        throw new Error(`ABC field ${name}: is unsupported or unsafe`);
      }
      if (name === "X") {
        referenceCount += 1;
        if (referenceCount > 1 || !/^[1-9]\d{0,5}$/.test(value)) {
          throw new Error("ABC must contain exactly one valid X: field");
        }
      } else if (name === "T") {
        titleCount += 1;
        if (titleCount > 1 || value.length > 200) {
          throw new Error("ABC supports exactly one bounded T: field");
        }
      } else if (name === "M") {
        if (!validMeter(value)) throw new Error("ABC meter is unsupported");
        meter ??= value;
      } else if (name === "L") {
        if (!validLength(value))
          throw new Error("ABC note length is unsupported");
      } else if (name === "Q") {
        const parsedTempo = tempoFromValue(value);
        if (parsedTempo === null) throw new Error("ABC tempo is unsupported");
        tempo ??= parsedTempo;
      } else if (name === "K") {
        if (!validKey(value)) throw new Error("ABC key or clef is unsupported");
        hasKey = true;
        keySignature ||= value.split(/\s+/u)[0]!;
        clef = clefFromKey(value);
      } else if (name === "V") {
        const voice = voiceFromValue(value);
        if (!voice) throw new Error("ABC voice declaration is unsupported");
        currentVoice = voice.id;
        voices.add(voice.id);
        currentMeasureByVoice.set(
          voice.id,
          currentMeasureByVoice.get(voice.id) ?? 1,
        );
        if (voice.clef) {
          clef = voice.clef;
          voiceClefs[voice.id] = voice.clef;
        }
      } else if (name === "w") {
        if (!hasKey) throw new Error("ABC lyrics must follow the K: field");
        lyricSyllableCount += value.split(/[\s-]+/u).filter(Boolean).length;
      }
      continue;
    }

    if (!hasKey) throw new Error("ABC music must follow the required K: field");
    validateMusicBody(line);
    systemCount += 1;
    let sanitizedLine = line;
    for (const match of line.matchAll(/\[([A-Za-z]):\s*([^\]]*)\]/gu)) {
      const name = match[1]!;
      const value = match[2]!.trim();
      if (!allowedInlineFields.has(name) || !safeText(value, 100)) {
        throw new Error(`Inline ABC field ${name}: is unsupported`);
      }
      if (name === "M" && !validMeter(value))
        throw new Error("Inline ABC meter is unsupported");
      if (name === "L" && !validLength(value))
        throw new Error("Inline ABC note length is unsupported");
      if (name === "Q" && tempoFromValue(value) === null)
        throw new Error("Inline ABC tempo is unsupported");
      if (name === "K" && !validKey(value))
        throw new Error("Inline ABC key is unsupported");
      if (name === "V") {
        const voice = voiceFromValue(value);
        if (!voice) throw new Error("Inline ABC voice is unsupported");
        currentVoice = voice.id;
        voices.add(voice.id);
        currentMeasureByVoice.set(
          voice.id,
          currentMeasureByVoice.get(voice.id) ?? 1,
        );
        if (voice.clef) voiceClefs[voice.id] = voice.clef;
      }
      sanitizedLine = sanitizedLine.replace(
        match[0],
        " ".repeat(match[0].length),
      );
    }
    const inertLine = withoutEmbeddedText(sanitizedLine);
    const tokens = [
      ...inertLine.matchAll(
        new RegExp(`(?:${eventPattern.source})|(?:\\|(?!=))`, "gu"),
      ),
    ];
    for (const match of tokens) {
      const value = match[0]!;
      if (value === "|") {
        currentMeasureByVoice.set(
          currentVoice,
          (currentMeasureByVoice.get(currentVoice) ?? 1) + 1,
        );
        continue;
      }
      const start = lineStart + rawLine.indexOf(line) + (match.index ?? 0);
      events.push({
        index: events.length + 1,
        measure: currentMeasureByVoice.get(currentVoice) ?? 1,
        voice: currentVoice,
        kind: /^[xzXZ]/u.test(value.replace(/^(?:\^\^|__|\^|_|=)/u, ""))
          ? "rest"
          : "note",
        value,
        sourceRange: { start, end: start + value.length },
      });
    }
  }

  if (referenceCount !== 1 || !hasKey || events.length === 0) {
    throw new Error(
      "ABC requires one X: field, one K: field and musical events",
    );
  }
  if (systemCount > maximumSystems)
    throw new Error("ABC exceeds the 16-system limit");
  const measureCount = Math.max(...events.map(({ measure }) => measure));
  if (measureCount > maximumMeasures)
    throw new Error("ABC exceeds the 128-measure limit");
  if (voices.size > 4) throw new Error("ABC exceeds the four-voice limit");
  if (events.length > maximumEvents)
    throw new Error("ABC exceeds the 2,000-event limit");
  if (lyricSyllableCount > maximumLyricSyllables)
    throw new Error("ABC exceeds the 200-syllable limit");

  return {
    eventCount: events.length,
    measureCount,
    systemCount,
    lyricSyllableCount,
    voices: voices.size ? [...voices] : ["default"],
    voiceClefs:
      voices.size > 0
        ? Object.fromEntries(
            [...voices].map((voice) => [voice, voiceClefs[voice] ?? clef]),
          )
        : { default: clef },
    keySignature,
    meter,
    clef,
    tempo,
    events,
  };
}

export const musicScoreBlockSchema = z
  .object({
    type: z.literal("musicScore"),
    version: z.literal(1),
    abc: z.string().min(1).max(maximumSourceLength),
    label: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(5_000),
    display: z
      .object({
        staffScale: z.enum(musicScoreStaffScales),
        sizePercent: z.number().int().min(50).max(120).default(100),
        keyboard: z.enum(musicScoreKeyboardModes).default("notes"),
        selectedVoice: z
          .string()
          .min(1)
          .max(24)
          .regex(/^[A-Za-z0-9_-]+$/u)
          .optional(),
        responsive: z.literal(true),
      })
      .strict(),
  })
  .strict()
  .superRefine((block, context) => {
    try {
      const metrics = validateMusicScoreAbc(block.abc);
      if (
        block.display.selectedVoice &&
        !metrics.voices.includes(block.display.selectedVoice)
      ) {
        context.addIssue({
          code: "custom",
          path: ["display", "selectedVoice"],
          message: "Selected ABC voice does not exist",
        });
      }
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["abc"],
        message: error instanceof Error ? error.message : "Invalid ABC source",
      });
    }
  });

export type MusicScoreBlock = z.infer<typeof musicScoreBlockSchema>;
