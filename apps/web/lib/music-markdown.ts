export type MusicScoreSource = {
  source: string;
  label: string;
  locale: "en" | "de";
  keySignature?: string;
  meter?: string;
};

const maxSourceLength = 30_000;
const maxLines = 1_000;
const maxEvents = 2_000;
const maxBarCharacters = 256;
const maxLyricSyllables = 200;
const allowedFields = new Set(["X", "T", "M", "L", "Q", "K", "V", "w"]);
const allowedInlineFields = new Set(["M", "L", "Q", "K", "V"]);
const allowedMusicCharacters = new Set(
  "ABCDEFGabcdefgxzXZ0123456789^_=,/'|:[](){}.!+<>~&- ".split(""),
);
const activeContentPattern =
  /<\s*\/?\s*(?:script|style|iframe|object|embed|form|link|svg|foreignObject)\b|\bon[a-z][a-z0-9_-]*\s*=|(?:javascript|data|file|https?|ftp):|\burl\s*\(|@import|expression\s*\(/iu;

const safeText = (value: string, maximum: number): boolean =>
  value.length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) &&
  !activeContentPattern.test(value);

const validKey = (value: string): boolean =>
  /^(?:none|HP|[A-G](?:b|#)?(?:m|mix|dor|phr|lyd|loc)?)(?:\s+(?:clef=)?(?:treble|bass|alto|tenor)(?:[+-]8)?)?$/i.test(
    value.trim(),
  );

const validMeter = (value: string): boolean =>
  /^(?:none|C\||C|\d{1,2}\/\d{1,2})$/i.test(value.trim());

const validLength = (value: string): boolean =>
  /^1\/(?:1|2|4|8|16|32|64)$/.test(value.trim());

const validTempo = (value: string): boolean =>
  /^(?:(?:1\/(?:1|2|4|8|16|32|64))=)?(?:[2-9]\d|[12]\d{2}|3[0-5]\d)$/.test(
    value.trim(),
  );

const validVoice = (value: string): boolean =>
  /^[A-Za-z0-9_-]{1,24}$/.test(value.trim());

const musicBodyWithoutText = (value: string): string =>
  value
    .replace(/\[[A-Za-z]:\s*[^\]]*\]/gu, "")
    .replace(/"[^"\n]{0,100}"/gu, "")
    .replace(/![A-Za-z][A-Za-z0-9_.+-]{0,30}!/gu, "");

const validMusicBody = (value: string): boolean => {
  for (const match of value.matchAll(/"([^"\n]{0,100})"/gu)) {
    if (!safeText(match[1]!, 100) || /[<>&]/u.test(match[1]!)) return false;
  }
  const withoutText = musicBodyWithoutText(value);
  return [...withoutText].every(
    (character) => character === "\t" || allowedMusicCharacters.has(character),
  );
};

export function musicScoreFromMarkdownSource(
  value: string,
  locale: "en" | "de",
): MusicScoreSource | null {
  const source = value.replaceAll("\r\n", "\n").trim();
  if (
    !safeText(source, maxSourceLength) ||
    source.includes("\r") ||
    source.includes("\0")
  ) {
    return null;
  }

  const lines = source.split("\n");
  if (lines.length > maxLines) return null;

  let referenceCount = 0;
  let hasKey = false;
  let hasBody = false;
  let title = "";
  let meter = "";
  let keySignature = "";
  let lyricSyllables = 0;
  const voices = new Set<string>();
  const bodyLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("%") || line.includes("%%")) return null;

    const field = line.match(/^([A-Za-z]):\s*(.*)$/u);
    if (field) {
      const name = field[1]!;
      const fieldValue = field[2]!.trim();
      if (
        !allowedFields.has(name) ||
        !safeText(fieldValue, 500) ||
        /[<>&]/u.test(fieldValue)
      )
        return null;
      if (name === "X") {
        referenceCount += 1;
        if (referenceCount > 1 || !/^[1-9]\d{0,5}$/.test(fieldValue))
          return null;
      } else if (name === "T") {
        if (!safeText(fieldValue, 200)) return null;
        title ||= fieldValue;
      } else if (name === "M") {
        if (!validMeter(fieldValue)) return null;
        meter ||= fieldValue;
      } else if (name === "L") {
        if (!validLength(fieldValue)) return null;
      } else if (name === "Q") {
        if (!validTempo(fieldValue)) return null;
      } else if (name === "K") {
        if (!validKey(fieldValue)) return null;
        hasKey = true;
        keySignature ||= fieldValue;
      } else if (name === "V") {
        if (!validVoice(fieldValue)) return null;
        voices.add(fieldValue);
      } else if (name === "w") {
        if (!hasKey) return null;
        lyricSyllables += fieldValue.split(/[\s-]+/u).filter(Boolean).length;
      }
      continue;
    }

    if (!hasKey) return null;
    for (const match of line.matchAll(/\[([A-Za-z]):\s*([^\]]*)\]/gu)) {
      const name = match[1]!;
      const fieldValue = match[2]!.trim();
      if (!allowedInlineFields.has(name) || !safeText(fieldValue, 100))
        return null;
      if (name === "M" && !validMeter(fieldValue)) return null;
      if (name === "L" && !validLength(fieldValue)) return null;
      if (name === "Q" && !validTempo(fieldValue)) return null;
      if (name === "K" && !validKey(fieldValue)) return null;
      if (name === "V") {
        if (!validVoice(fieldValue)) return null;
        voices.add(fieldValue);
      }
    }
    if (!validMusicBody(line)) return null;
    bodyLines.push(line);
    hasBody = true;
  }

  const bodySource = bodyLines.join("\n");
  const eventCount = (
    musicBodyWithoutText(bodySource).match(
      /[A-Ga-gxz](?:[',]*)(?:\d+|\/\d*)?/g,
    ) ?? []
  ).length;
  const barCharacters = (bodySource.match(/\|/g) ?? []).length;
  if (
    referenceCount !== 1 ||
    !hasKey ||
    !hasBody ||
    voices.size > 4 ||
    eventCount === 0 ||
    eventCount > maxEvents ||
    barCharacters > maxBarCharacters ||
    lyricSyllables > maxLyricSyllables
  ) {
    return null;
  }

  return {
    source,
    label: title || (locale === "de" ? "Notensatz" : "Music notation"),
    locale,
    keySignature: keySignature || undefined,
    meter: meter || undefined,
  };
}
