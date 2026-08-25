"use client";

import { decompress } from "fzstd";
import JSZip from "jszip";
import initSqlJs from "sql.js/dist/sql-asm.js";

import {
  ankiMathToMarkdown,
  cardContentSchema,
  localizedCardContentsSchema,
  type CardContent,
  type LocalizedCardContents,
} from "@flashcards/domain/content";
import {
  contentStyleDefinitionsSchema,
  type ContentStyleDefinition,
} from "@flashcards/domain/content-style";
import {
  createAnkiImportPreview,
  prepareAnkiCompatiblePackage,
  prepareAnkiFieldMappedPackage,
  selectAnkiSourceDecks,
  selectedAnkiMediaNames,
  suggestedAnkiFieldMappings,
  xefjordAnkiFieldMappings,
  type AnkiFieldMapping,
  type AnkiImportPreview,
} from "@flashcards/domain/anki-import-plan";
import {
  createAnkiImportHierarchy,
  sortAnkiDecksHierarchically,
} from "@flashcards/domain/anki-import-hierarchy";
import { applyCustomAnkiImportProfile } from "@flashcards/domain/anki-import-apply-profile";
import {
  automaticAnkiTemplateProfileId,
  manualAnkiFieldMappingProfileId,
  xefjordAnkiProfileId,
  type AnkiImportProfileSelection,
} from "@flashcards/domain/anki-import-profile";
import {
  ankiTemplateFieldNames,
  renderAnkiTemplate,
} from "@flashcards/domain/anki-template-renderer";
import { removeRepeatedAnkiQuestionFromAnswer } from "@flashcards/domain/anki-language-direction";
import type {
  AnkiCardContent,
  ParsedAnkiPackage,
} from "@flashcards/domain/anki-import-types";
import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";
import {
  fnfV3CardSchema,
  fnfV3DeckSchema,
  fnfV3ManifestSchema,
  fnfV3MediaSchema,
  fnfV3MimeType,
  fnfV3NoteSchema,
  parseFnfV3JsonLines,
  validateFnfV3ContentReferences,
} from "@flashcards/package-format";

const maximumArchiveBytes = 256 * 1024 * 1024;
const maximumCollectionBytes = 96 * 1024 * 1024;
const maximumEntries = 25_000;
const maximumCards = 50_000;
const maximumMediaBytes = 64 * 1024 * 1024;

export type LocalImportMedia = {
  sourceName: string;
  mimeType: string;
  bytes: Uint8Array;
  kind: "image" | "audio" | "video";
};

export type LocalImportCard = {
  sourceId: string;
  sourceNoteId: string;
  sourceNoteTypeId?: string;
  sourceNoteTypeName?: string;
  sourceTemplateOrd?: number;
  sourceClozeOrdinal?: number;
  sourceTemplateName?: string;
  sourceOriginalTemplateOrd?: number;
  sourceOriginalTemplateName?: string;
  sourceNoteGuid?: string;
  profileRuleId?: string;
  profileOutputId?: string;
  sourceFields?: Record<string, AnkiCardContent>;
  sourceDisplayedFields?: string[];
  sourceTechnicalFields?: string[];
  sourceFieldText?: Record<string, string>;
  sourceFieldRaw?: Record<string, string>;
  sourceState?: {
    cardType: number;
    queue: number;
    cardFlag: number;
    noteFlag: number;
  };
  front: CardContent;
  back: CardContent;
  supplementalContent?: Array<{ label: string; content: CardContent }>;
  tags: string[];
  questionLocale?: string;
  answerLocale?: string;
  languageDirectionMode?: "DECK_DEFAULT" | "DECK_REVERSED" | "CUSTOM";
  linkedToPrevious?: boolean;
  ratingEnabled?: boolean;
  translations?: LocalizedCardContents;
  kind?: "QUESTION" | "EXPLANATION";
  usage?: "LEARNING" | "REFERENCE";
  suspended?: boolean;
};

export type LocalImportDeck = {
  sourceId: string;
  path: string[];
  cards: LocalImportCard[];
  description?: string;
  language?: string;
  contentLocales?: string[];
  defaultContentLocale?: string;
  sourceLocale?: string;
  targetLocale?: string;
  languageDirectionMode?: "OVERRIDE" | "INHERIT";
  sourceLocaleOverride?: string | null;
  targetLocaleOverride?: string | null;
  studyOrder?: "SCHEDULED" | "SEQUENTIAL";
  tags?: string[];
  visual?:
    | { kind: "IMAGE"; value: string }
    | { kind: "MAP"; value: string }
    | { kind: "FLAG"; value: string }
    | { kind: "GLOBE"; value: "world" }
    | null;
  sourceTemplateKey?: string | null;
  contentStyles?: ContentStyleDefinition[];
};

export type LocalFileImport = {
  title: string;
  decks: LocalImportDeck[];
  media: LocalImportMedia[];
  warnings: string[];
  format: "APKG" | "FNF";
  suggestedSourceLocale?: string;
  suggestedTargetLocale?: string;
  ankiPreview?: AnkiImportPreview;
  coverSourceName?: string;
  importProfile?: "XEFJORD";
  sourceCollectionKey?: string;
  packageSha256?: string;
  profileId?: string;
  profileVersion?: number;
};

export type LocalAnkiImportOptions = {
  includedSourceDeckIds?: string[];
  mappings?: Record<string, AnkiFieldMapping>;
  subdeckFields?: Record<string, string[]>;
  profileSelection?: AnkiImportProfileSelection;
  includedMediaGroupIds?: string[];
  coverSourceName?: string;
  includeReverseCards?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: LocalAnkiImportProgress) => void;
};

type DetectedLocale = { locale: string; confidence: number };

const detectSampleLocale = (sample: string): DetectedLocale | null => {
  const text = sample
    .replace(/<[^>]*>/g, " ")
    .replace(/\[sound:[^\]]+\]/gi, " ")
    .slice(0, 20_000);
  const scriptChecks: Array<[RegExp, string]> = [
    [/[\u3040-\u30ff]/u, "ja"],
    [/[\uac00-\ud7af]/u, "ko"],
    [/[\u4e00-\u9fff]/u, "zh"],
    [/[\u0600-\u06ff]/u, "ar"],
    [/[\u0590-\u05ff]/u, "he"],
    [/[\u0900-\u097f]/u, "hi"],
    [/[\u0e00-\u0e7f]/u, "th"],
    [/[\u0370-\u03ff]/u, "el"],
    [/[\u0400-\u04ff]/u, "ru"],
  ];
  for (const [pattern, locale] of scriptChecks) {
    if (pattern.test(text)) return { locale, confidence: 0.98 };
  }
  const words =
    text
      .toLocaleLowerCase()
      .match(/[a-zà-ÿ]+/g)
      ?.slice(0, 500) ?? [];
  if (words.length < 4) return null;
  const markers: Record<string, readonly string[]> = {
    de: [
      "der",
      "die",
      "das",
      "und",
      "ist",
      "nicht",
      "mit",
      "ein",
      "eine",
      "was",
      "wie",
    ],
    en: [
      "the",
      "and",
      "is",
      "are",
      "not",
      "with",
      "this",
      "that",
      "what",
      "how",
      "of",
    ],
    es: [
      "el",
      "la",
      "los",
      "las",
      "y",
      "es",
      "con",
      "una",
      "que",
      "como",
      "para",
    ],
    fr: [
      "le",
      "la",
      "les",
      "et",
      "est",
      "avec",
      "une",
      "des",
      "que",
      "comment",
      "pour",
    ],
    it: [
      "il",
      "lo",
      "la",
      "gli",
      "e",
      "con",
      "una",
      "che",
      "come",
      "per",
      "non",
    ],
    pt: ["o", "a", "os", "as", "e", "com", "uma", "que", "como", "para", "não"],
    nl: [
      "de",
      "het",
      "een",
      "en",
      "is",
      "met",
      "niet",
      "wat",
      "hoe",
      "voor",
      "van",
    ],
    pl: ["i", "jest", "nie", "z", "na", "to", "jak", "dla", "się", "co", "w"],
    tr: [
      "ve",
      "bir",
      "bu",
      "ile",
      "değil",
      "ne",
      "nasıl",
      "için",
      "olan",
      "da",
    ],
  };
  const scores = Object.entries(markers)
    .map(([locale, entries]) => ({
      locale,
      score: words.reduce(
        (count, word) => count + (entries.includes(word) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score);
  const best = scores[0];
  const runnerUp = scores[1];
  if (!best || best.score < 2 || best.score <= (runnerUp?.score ?? 0))
    return null;
  return {
    locale: best.locale,
    confidence: Math.min(0.95, 0.65 + best.score / Math.max(words.length, 12)),
  };
};

export const detectAnkiPreviewLanguageDirection = (
  preview: AnkiImportPreview,
): {
  sourceLocale: string;
  targetLocale: string;
  confidence: number;
} | null => {
  if (
    preview.xefjordPreset.suggestedSourceLocale &&
    preview.xefjordPreset.suggestedTargetLocale
  ) {
    return {
      sourceLocale: preview.xefjordPreset.suggestedSourceLocale,
      targetLocale: preview.xefjordPreset.suggestedTargetLocale,
      confidence: 1,
    };
  }
  const samples = (role: "PRIMARY_A" | "PRIMARY_B") =>
    preview.noteTypes
      .flatMap((noteType) => noteType.fields)
      .filter((field) => field.suggestedRole === role)
      .flatMap((field) => [field.sample, ...field.sampleValues])
      .filter(Boolean)
      .slice(0, 60)
      .join(" \n");
  const source = detectSampleLocale(samples("PRIMARY_A"));
  const target = detectSampleLocale(samples("PRIMARY_B"));
  if (
    !source ||
    !target ||
    Math.min(source.confidence, target.confidence) < 0.7
  ) {
    return null;
  }
  return {
    sourceLocale: source.locale,
    targetLocale: target.locale,
    confidence: Math.min(source.confidence, target.confidence),
  };
};

export type LocalAnkiImportProgress = {
  phase:
    | "READING_ARCHIVE"
    | "UNPACKING"
    | "READING_DATABASE"
    | "READING_MEDIA"
    | "READING_CARDS"
    | "BUILDING_PREVIEW"
    | "APPLYING_PROFILE";
  completed: number;
  total: number | null;
};

type ArchiveEntries = Map<string, Uint8Array>;
type SqlValue = number | string | Uint8Array | null;
type SqlRow = Record<string, SqlValue>;
type AnkiTemplate = {
  ord: number;
  name: string;
  question: string;
  answer: string;
};
type AnkiModel = {
  id: string;
  name: string;
  fields: string[];
  templates: AnkiTemplate[];
  cloze: boolean;
};

const archiveCache = new WeakMap<
  File,
  Promise<{ entries: ArchiveEntries; sha256: string }>
>();

const abortIfRequested = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException(
      "Der lokale Import wurde abgebrochen.",
      "AbortError",
    );
  }
};

const yieldToMainThread = async () =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

const decode = (bytes: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);

const sha256Hex = async (bytes: BufferSource): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const readArchive = async (
  file: File,
  signal?: AbortSignal,
  onProgress?: LocalAnkiImportOptions["onProgress"],
): Promise<{ entries: ArchiveEntries; sha256: string }> => {
  const cached = archiveCache.get(file);
  if (cached) {
    abortIfRequested(signal);
    onProgress?.({ phase: "UNPACKING", completed: 1, total: 1 });
    return cached;
  }
  const read = (async () => {
    if (file.size <= 0 || file.size > maximumArchiveBytes) {
      throw new Error("Die Importdatei überschreitet die Sicherheitsgrenze.");
    }
    abortIfRequested(signal);
    onProgress?.({ phase: "READING_ARCHIVE", completed: 0, total: file.size });
    const archiveBytes = new Uint8Array(await file.arrayBuffer());
    abortIfRequested(signal);
    onProgress?.({
      phase: "READING_ARCHIVE",
      completed: archiveBytes.byteLength,
      total: file.size,
    });
    const sha256 = await sha256Hex(archiveBytes);
    abortIfRequested(signal);
    const zip = await JSZip.loadAsync(archiveBytes, {
      checkCRC32: true,
      createFolders: false,
    });
    const files = Object.values(zip.files).filter((entry) => !entry.dir);
    if (files.length === 0 || files.length > maximumEntries) {
      throw new Error("Das Archiv enthält keine oder zu viele Dateien.");
    }
    const result = new Map<string, Uint8Array>();
    let expandedBytes = 0;
    for (const [index, entry] of files.entries()) {
      abortIfRequested(signal);
      const unsafeOriginalName = (
        entry as typeof entry & { unsafeOriginalName?: string }
      ).unsafeOriginalName;
      if (unsafeOriginalName && unsafeOriginalName !== entry.name) {
        throw new Error("Das Archiv enthält einen unsicheren Dateipfad.");
      }
      const name = entry.name.normalize("NFC");
      const permissions =
        typeof entry.unixPermissions === "string"
          ? Number.parseInt(entry.unixPermissions, 8)
          : entry.unixPermissions;
      if (
        !name ||
        name.length > 512 ||
        name.includes("\0") ||
        name.startsWith("/") ||
        name.includes("\\") ||
        name.split("/").length > 20 ||
        name
          .split("/")
          .some(
            (part) =>
              part === "" || part === "." || part === ".." || part.length > 255,
          ) ||
        (typeof permissions === "number" &&
          (permissions & 0o170000) === 0o120000)
      ) {
        throw new Error("Das Archiv enthält einen unsicheren Dateipfad.");
      }
      if (result.has(name)) {
        throw new Error("Das Archiv enthält doppelte Unicode-Dateinamen.");
      }
      const bytes = await entry.async("uint8array");
      expandedBytes += bytes.byteLength;
      if (expandedBytes > maximumArchiveBytes) {
        throw new Error(
          "Das entpackte Archiv überschreitet die Sicherheitsgrenze.",
        );
      }
      result.set(name, bytes);
      onProgress?.({
        phase: "UNPACKING",
        completed: index + 1,
        total: files.length,
      });
      if ((index + 1) % 25 === 0) await yieldToMainThread();
    }
    return { entries: result, sha256 };
  })();
  archiveCache.set(file, read);
  try {
    return await read;
  } catch (cause) {
    archiveCache.delete(file);
    throw cause;
  }
};

const readVarint = (input: Uint8Array, start: number) => {
  let value = 0;
  let multiplier = 1;
  let offset = start;
  while (offset < input.length && offset - start < 10) {
    const byte = input[offset++]!;
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, next: offset };
    multiplier *= 128;
  }
  throw new Error("Ungültige Protobuf-Daten im Anki-Paket.");
};

const readProto = (input: Uint8Array) => {
  const values: Array<{
    field: number;
    wire: number;
    value: number | Uint8Array;
  }> = [];
  let offset = 0;
  while (offset < input.length) {
    const key = readVarint(input, offset);
    offset = key.next;
    const field = Math.floor(key.value / 8);
    const wire = key.value % 8;
    if (field < 1) throw new Error("Ungültiges Protobuf-Feld.");
    if (wire === 0) {
      const item = readVarint(input, offset);
      offset = item.next;
      values.push({ field, wire, value: item.value });
    } else if (wire === 1 || wire === 5) {
      const size = wire === 1 ? 8 : 4;
      if (offset + size > input.length)
        throw new Error("Defektes Protobuf-Feld.");
      values.push({
        field,
        wire,
        value: input.subarray(offset, offset + size),
      });
      offset += size;
    } else if (wire === 2) {
      const length = readVarint(input, offset);
      offset = length.next;
      if (offset + length.value > input.length)
        throw new Error("Defektes Protobuf-Feld.");
      values.push({
        field,
        wire,
        value: input.subarray(offset, offset + length.value),
      });
      offset += length.value;
    } else {
      throw new Error("Nicht unterstütztes Protobuf-Feld.");
    }
  }
  return values;
};

const protoNumber = (input: Uint8Array, field: number): number | undefined => {
  const value = readProto(input).find(
    (candidate) => candidate.field === field && candidate.wire === 0,
  )?.value;
  return typeof value === "number" ? value : undefined;
};

const protoString = (input: Uint8Array, field: number): string => {
  const value = readProto(input).find(
    (candidate) => candidate.field === field && candidate.wire === 2,
  )?.value;
  return value instanceof Uint8Array ? decode(value) : "";
};

const boundedDecompress = (
  bytes: Uint8Array,
  maximum: number,
  label: string,
) => {
  const result = decompress(bytes);
  if (result.byteLength > maximum) {
    throw new Error(`${label} überschreitet die Sicherheitsgrenze.`);
  }
  return result;
};

const replaceAscii = (bytes: Uint8Array, from: string, to: string) => {
  if (from.length !== to.length) throw new Error("Ungültige SQLite-Reparatur.");
  const source = new TextEncoder().encode(from);
  const target = new TextEncoder().encode(to);
  const result = bytes.slice();
  for (let index = 0; index <= result.length - source.length; index += 1) {
    if (source.every((byte, offset) => result[index + offset] === byte)) {
      result.set(target, index);
      index += source.length - 1;
    }
  }
  return result;
};

const query = (
  database: {
    exec(
      sql: string,
      params?: SqlValue[],
    ): Array<{ columns: string[]; values: SqlValue[][] }>;
  },
  sql: string,
  params: SqlValue[] = [],
): SqlRow[] => {
  const result = database.exec(sql, params)[0];
  if (!result) return [];
  return result.values.map((values) =>
    Object.fromEntries(
      result.columns.map((column, index) => [column, values[index] ?? null]),
    ),
  );
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_match, number: string) =>
      String.fromCodePoint(Number(number)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, number: string) =>
      String.fromCodePoint(Number.parseInt(number, 16)),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const plainText = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(
        /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        "",
      )
      .replace(
        /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*\/?\s*>/gi,
        "",
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li|tr|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 50_000);

const safeMediaName = (value: string): string | null => {
  const decoded = decodeHtmlEntities(value).trim();
  if (
    !decoded ||
    decoded.length > 255 ||
    /^(?:https?:|data:|javascript:|file:|\/\/)/i.test(decoded) ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(decoded)
  ) {
    return null;
  }
  try {
    return decodeURIComponent(decoded).normalize("NFC");
  } catch {
    return decoded.normalize("NFC");
  }
};

const completeAnkiCardSides = (
  card: Pick<
    ParsedAnkiPackage["decks"][number]["cards"][number],
    "front" | "back"
  >,
): { front: CardContent; back: CardContent; kind?: "EXPLANATION" } => {
  const hasFront = card.front.blocks.length > 0;
  const hasBack = card.back.blocks.length > 0;
  const unsupported: AnkiCardContent = {
    blocks: [
      {
        type: "markdown",
        revealMode: "ALL",
        source: "Nicht unterstützter Anki-Inhalt.",
      },
    ],
  };
  const front = hasFront ? card.front : hasBack ? card.back : unsupported;
  const back = hasBack ? card.back : front;
  return {
    front: front as CardContent,
    back: back as CardContent,
    ...(!hasFront || !hasBack ? { kind: "EXPLANATION" as const } : {}),
  };
};

const htmlAttribute = (tag: string, name: string): string => {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
};

const mediaType = (
  bytes: Uint8Array,
  name: string,
): Omit<LocalImportMedia, "sourceName" | "bytes"> | null => {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes[0] === 0x89 && ascii(1, 3) === "PNG")
    return { mimeType: "image/png", kind: "image" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8)
    return { mimeType: "image/jpeg", kind: "image" };
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")
    return { mimeType: "image/gif", kind: "image" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP")
    return { mimeType: "image/webp", kind: "image" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE")
    return { mimeType: "audio/wav", kind: "audio" };
  if (ascii(0, 4) === "fLaC") return { mimeType: "audio/flac", kind: "audio" };
  if (ascii(0, 4) === "OggS") return { mimeType: "audio/ogg", kind: "audio" };
  if (
    ascii(0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
  )
    return { mimeType: "audio/mpeg", kind: "audio" };
  if (ascii(4, 4) === "ftyp") {
    return /\.(?:mp4|m4v)$/i.test(name)
      ? { mimeType: "video/mp4", kind: "video" }
      : { mimeType: "audio/mp4", kind: "audio" };
  }
  return null;
};

const contentFromHtml = (
  html: string,
  media: ReadonlyMap<string, LocalImportMedia>,
  warnings: Set<string>,
  options: { allowEmpty?: boolean; context?: string } = {},
): CardContent => {
  if (/<\s*script\b|(?:^|\s)on[a-z]+\s*=/i.test(html)) {
    warnings.add(
      "Ausführbarer Anki-Vorlagencode wurde nicht ausgeführt und sicher ausgelassen.",
    );
  }
  if (/<\s*style\b|\sstyle\s*=/i.test(html)) {
    warnings.add(
      "Anki-CSS wurde nicht übernommen; der Karteninhalt bleibt erhalten.",
    );
  }
  const blocks: Array<Record<string, unknown>> = [];
  const markers: Array<Record<string, unknown>> = [];
  const mark = (block: Record<string, unknown>) => {
    const index = markers.push(block) - 1;
    return `\u0000FNF_MEDIA_${index}\u0000`;
  };
  const safe = html
    .replace(
      /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*\/?\s*>/gi,
      "",
    )
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const source = htmlAttribute(tag, "src");
      const name = safeMediaName(source);
      if (!name) {
        warnings.add("Eine unsichere Bildreferenz wurde ausgelassen.");
        return "";
      }
      if (media.get(name)?.kind !== "image") {
        warnings.add(`Fehlendes oder ungültiges Bild ausgelassen: ${name}`);
        return "";
      }
      const alt = decodeHtmlEntities(htmlAttribute(tag, "alt")).slice(0, 500);
      return mark({
        type: "importImage",
        sourceName: name,
        alt,
        decorative: !alt,
      });
    })
    .replace(/\[sound:([^\]\r\n]+)\]/gi, (_token, source: string) => {
      const name = safeMediaName(source);
      if (!name) {
        warnings.add("Eine unsichere Audioreferenz wurde ausgelassen.");
        return "";
      }
      if (media.get(name)?.kind !== "audio") {
        warnings.add(`Fehlendes oder ungültiges Audio ausgelassen: ${name}`);
        return "";
      }
      return mark({
        type: "importAudio",
        sourceName: name,
        label: name.slice(0, 300),
      });
    });
  const pattern = /\u0000FNF_MEDIA_(\d+)\u0000/g;
  const appendTextBlock = (value: string) => {
    const text = plainText(value);
    if (!text) return;
    const normalized = ankiMathToMarkdown(text);
    normalized.warnings.forEach((warning) =>
      warnings.add(
        options.context ? `${options.context}: ${warning}` : warning,
      ),
    );
    if (normalized.text) {
      blocks.push({
        type: "markdown",
        revealMode: "ALL",
        source: normalized.text,
      });
    }
  };
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(safe))) {
    appendTextBlock(safe.slice(cursor, match.index));
    const mediaBlock = markers[Number(match[1])];
    if (mediaBlock) blocks.push(mediaBlock);
    cursor = match.index + match[0].length;
  }
  appendTextBlock(safe.slice(cursor));
  if (!blocks.length && !options.allowEmpty)
    blocks.push({
      type: "markdown",
      revealMode: "ALL",
      source: "Nicht unterstützter Anki-Inhalt.",
    });
  // Import media placeholders are replaced with UUID-backed structured blocks
  // immediately before the atomic local commit.
  return { blocks } as unknown as CardContent;
};

const parseLegacyModels = (raw: string): Map<string, AnkiModel> => {
  const parsed = JSON.parse(raw) as Record<
    string,
    {
      id?: number;
      name?: string;
      type?: number;
      flds?: Array<{ name?: string; ord?: number }>;
      tmpls?: Array<{
        name?: string;
        ord?: number;
        qfmt?: string;
        afmt?: string;
      }>;
    }
  >;
  return new Map(
    Object.entries(parsed).map(([key, model]) => {
      const id = String(model.id ?? key);
      return [
        id,
        {
          id,
          name: model.name ?? "Anki-Notiztyp",
          cloze: model.type === 1,
          fields: [...(model.flds ?? [])]
            .sort((left, right) => (left.ord ?? 0) - (right.ord ?? 0))
            .map((field) => field.name ?? "Feld"),
          templates: [...(model.tmpls ?? [])].map((template, index) => ({
            ord: template.ord ?? index,
            name: template.name ?? `Karte ${index + 1}`,
            question: template.qfmt ?? "",
            answer: template.afmt ?? "",
          })),
        },
      ];
    }),
  );
};

const parseMedia = async (
  entries: ArchiveEntries,
  latest: boolean,
  warnings: Set<string>,
  signal?: AbortSignal,
  onProgress?: LocalAnkiImportOptions["onProgress"],
) => {
  const rawManifest = entries.get("media");
  if (!rawManifest) return [];
  const manifestBytes = latest
    ? boundedDecompress(rawManifest, 16 * 1024 * 1024, "Das Medienmanifest")
    : rawManifest;
  const manifest: Array<{
    archiveName: string;
    sourceName: string;
    size?: number;
  }> = latest
    ? readProto(manifestBytes)
        .filter(
          (item) =>
            item.field === 1 &&
            item.wire === 2 &&
            item.value instanceof Uint8Array,
        )
        .map((item, index) => {
          const fields = readProto(item.value as Uint8Array);
          const name = fields.find(
            (field) => field.field === 1 && field.wire === 2,
          )?.value;
          const size = fields.find(
            (field) => field.field === 2 && field.wire === 0,
          )?.value;
          if (!(name instanceof Uint8Array) || typeof size !== "number")
            throw new Error("Das Anki-Medienmanifest ist beschädigt.");
          return {
            archiveName: String(index),
            sourceName: decode(name).normalize("NFC"),
            size,
          };
        })
    : Object.entries(
        JSON.parse(decode(manifestBytes)) as Record<string, string>,
      ).map(([archiveName, sourceName]) => ({
        archiveName,
        sourceName: sourceName.normalize("NFC"),
      }));
  const media: LocalImportMedia[] = [];
  for (const [index, item] of manifest.entries()) {
    abortIfRequested(signal);
    if (!safeMediaName(item.sourceName)) {
      warnings.add("Ein unsicherer Medienname wurde ausgelassen.");
      continue;
    }
    const archived = entries.get(item.archiveName);
    if (!archived) continue;
    let bytes: Uint8Array;
    try {
      bytes = latest
        ? boundedDecompress(archived, maximumMediaBytes, item.sourceName)
        : archived;
    } catch {
      warnings.add(`Beschädigtes Medium ausgelassen: ${item.sourceName}`);
      continue;
    }
    if (
      bytes.byteLength <= 0 ||
      bytes.byteLength > maximumMediaBytes ||
      (item.size !== undefined && bytes.byteLength !== item.size)
    ) {
      warnings.add(`Ungültiges Medium ausgelassen: ${item.sourceName}`);
      continue;
    }
    let detected = mediaType(bytes, item.sourceName);
    if (!detected && /\.svg$/i.test(item.sourceName)) {
      const sanitized = sanitizeSvgBytes(bytes);
      if (sanitized) {
        bytes = sanitized;
        detected = { mimeType: "image/svg+xml", kind: "image" };
      }
    }
    if (!detected) {
      warnings.add(
        `Nicht unterstütztes Medium ausgelassen: ${item.sourceName}`,
      );
      continue;
    }
    media.push({ sourceName: item.sourceName, bytes, ...detected });
    onProgress?.({
      phase: "READING_MEDIA",
      completed: index + 1,
      total: manifest.length,
    });
    if ((index + 1) % 50 === 0) await yieldToMainThread();
  }
  return media;
};

const safePath = (value: string) =>
  value
    .split(/::|\u001f/u)
    .map((part) => plainText(part).replace(/\s+/g, " ").trim().slice(0, 120))
    .filter(Boolean);

export async function parseLocalAnkiPackage(
  file: File,
  languageDirection?: { sourceLocale: string; targetLocale: string },
  options: LocalAnkiImportOptions = {},
): Promise<LocalFileImport> {
  if (!/\.apkg$/i.test(file.name)) {
    throw new Error("Die Anki-Datei benötigt die Endung .apkg.");
  }
  abortIfRequested(options.signal);
  const { entries, sha256: packageSha256 } = await readArchive(
    file,
    options.signal,
    options.onProgress,
  );
  const meta = entries.get("meta");
  const latest = Boolean(
    meta && protoNumber(meta, 1) === 3 && entries.has("collection.anki21b"),
  );
  const collectionName = latest
    ? "collection.anki21b"
    : entries.has("collection.anki21")
      ? "collection.anki21"
      : "collection.anki2";
  const archivedCollection = entries.get(collectionName);
  if (!archivedCollection)
    throw new Error("Im Anki-Paket fehlt die Collection-Datenbank.");
  let collection = latest
    ? boundedDecompress(
        archivedCollection,
        maximumCollectionBytes,
        "Die Anki-Collection",
      )
    : archivedCollection;
  if (decode(collection.subarray(0, 16)) !== "SQLite format 3\0") {
    throw new Error("Die Anki-Collection ist keine gültige SQLite-Datenbank.");
  }
  collection = replaceAscii(collection, "unicase", "binary ");
  const SQL = await initSqlJs();
  abortIfRequested(options.signal);
  options.onProgress?.({
    phase: "READING_DATABASE",
    completed: 1,
    total: 1,
  });
  const database = new SQL.Database(collection);
  try {
    const collectionColumns = new Set(
      query(database, "PRAGMA table_info(col)").map((row) => String(row.name)),
    );
    const col = query(
      database,
      `SELECT ver, models, decks${collectionColumns.has("crt") ? ", crt" : ""} FROM col LIMIT 1`,
    )[0];
    if (!col) throw new Error("Die Anki-Collection ist leer.");
    let models: Map<string, AnkiModel>;
    let deckNames: Map<string, string>;
    if (Number(col.ver) >= 15) {
      const noteTypes = query(
        database,
        "SELECT id, name, config FROM notetypes",
      );
      const fields = query(
        database,
        "SELECT ntid, ord, name FROM fields ORDER BY ntid, ord",
      );
      const templates = query(
        database,
        "SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord",
      );
      models = new Map(
        noteTypes.map((noteType) => {
          const id = String(noteType.id);
          const config =
            noteType.config instanceof Uint8Array
              ? noteType.config
              : new Uint8Array();
          return [
            id,
            {
              id,
              name: String(noteType.name ?? "Anki-Notiztyp"),
              cloze: protoNumber(config, 1) === 1,
              fields: fields
                .filter((field) => String(field.ntid) === id)
                .map((field) => String(field.name)),
              templates: templates
                .filter((template) => String(template.ntid) === id)
                .map((template) => {
                  const bytes =
                    template.config instanceof Uint8Array
                      ? template.config
                      : new Uint8Array();
                  return {
                    ord: Number(template.ord),
                    name: String(template.name ?? "Anki-Karte"),
                    question: protoString(bytes, 1),
                    answer: protoString(bytes, 2),
                  };
                }),
            },
          ];
        }),
      );
      deckNames = new Map(
        query(database, "SELECT id, name FROM decks").map((deck) => [
          String(deck.id),
          String(deck.name),
        ]),
      );
    } else {
      models = parseLegacyModels(String(col.models));
      const decks = JSON.parse(String(col.decks)) as Record<
        string,
        { id?: number; name?: string }
      >;
      deckNames = new Map(
        Object.entries(decks).map(([id, deck]) => [
          String(deck.id ?? id),
          deck.name ?? "Anki-Deck",
        ]),
      );
    }
    const rows = query(
      database,
      `SELECT c.id AS card_id, n.id AS note_id, n.guid AS note_guid, c.did AS deck_id,
        c.odid AS original_deck_id, c.ord AS ord, n.mid AS model_id,
        c.type AS card_type, c.queue AS queue, c.flags AS card_flags,
        n.flags AS note_flags, n.tags AS tags, n.flds AS fields
       FROM cards c INNER JOIN notes n ON n.id = c.nid
       ORDER BY c.id LIMIT ?`,
      [maximumCards + 1],
    );
    if (rows.length > maximumCards)
      throw new Error(
        `Das Anki-Paket enthält mehr als ${maximumCards} Karten.`,
      );
    const warnings = new Set<string>();
    const media = await parseMedia(
      entries,
      latest,
      warnings,
      options.signal,
      options.onProgress,
    );
    const mediaByName = new Map(media.map((item) => [item.sourceName, item]));
    const decks = new Map<string, ParsedAnkiPackage["decks"][number]>();
    for (const [rowIndex, row] of rows.entries()) {
      abortIfRequested(options.signal);
      const model = models.get(String(row.model_id));
      if (!model) continue;
      const ordinal = Number(row.ord);
      const template = model.cloze
        ? model.templates[0]
        : model.templates.find((item) => item.ord === ordinal);
      if (!template) continue;
      const values = String(row.fields).split("\u001f");
      const fields = new Map(
        model.fields.map((name, index) => [
          name,
          (values[index] ?? "").slice(0, 50_000),
        ]),
      );
      const sourceFields = Object.fromEntries(
        [...fields].map(([name, value]) => [
          name,
          contentFromHtml(value, mediaByName, warnings, {
            allowEmpty: true,
            context: `${model.name} / ${name}`,
          }) as AnkiCardContent,
        ]),
      );
      const sourceFieldText = Object.fromEntries(
        [...fields].map(([name, value]) => [name, plainText(value)]),
      );
      const sourceFieldRaw = Object.fromEntries(fields);
      const tags = String(row.tags)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 30)
        .map((tag) => tag.slice(0, 40));
      const sourceDeckId =
        String(row.original_deck_id) !== "0"
          ? String(row.original_deck_id)
          : String(row.deck_id);
      const path = safePath(
        deckNames.get(sourceDeckId) ?? "Importiertes Anki-Deck",
      );
      const templateContext = {
        fields,
        ordinal,
        deckPath: path,
        noteTypeName: model.name,
        templateName: template.name,
        // Tags are retained as card metadata below. Rendering {{Tags}} into the
        // learning content would duplicate metadata as question/answer text.
        tags: [],
        cardFlag: Number(row.card_flags ?? 0),
      };
      const frontResult = renderAnkiTemplate(template.question, {
        ...templateContext,
        answer: false,
      });
      const backResult = renderAnkiTemplate(template.answer, {
        ...templateContext,
        answer: true,
        // Flash-n-Flip renders question and answer as separate semantic sides.
        // Anki's FrontSide is presentation chrome and must not be copied into
        // the answer a second time.
        front: "",
      });
      frontResult.warnings.forEach((warning) => warnings.add(warning));
      backResult.warnings.forEach((warning) => warnings.add(warning));
      const renderedFront = frontResult.html;
      let renderedBack = backResult.html;
      const separator = renderedBack.match(
        /<hr\b[^>]*\bid\s*=\s*(?:["']answer["']|answer)[^>]*>/i,
      );
      if (separator?.index !== undefined)
        renderedBack = renderedBack.slice(
          separator.index + separator[0].length,
        );
      const parsedFront = contentFromHtml(
        renderedFront,
        mediaByName,
        warnings,
        {
          allowEmpty: true,
          context: `${model.name} / ${template.name} / Vorderseite`,
        },
      ) as AnkiCardContent;
      const parsedBack = contentFromHtml(renderedBack, mediaByName, warnings, {
        allowEmpty: true,
        context: `${model.name} / ${template.name} / Rückseite`,
      }) as AnkiCardContent;
      const semanticBack = removeRepeatedAnkiQuestionFromAnswer(
        parsedFront,
        parsedBack,
      ).content;
      const deck = decks.get(sourceDeckId) ?? {
        sourceDeckId,
        title: path.at(-1) ?? "Importiertes Anki-Deck",
        path: path.length ? path : ["Importiertes Anki-Deck"],
        cards: [],
      };
      deck.cards.push({
        sourceCardId: String(row.card_id),
        sourceNoteId: String(row.note_id),
        sourceNoteGuid: String(row.note_guid || row.note_id),
        sourceNoteTypeId: model.id,
        sourceNoteTypeName: model.name,
        sourceTemplateOrd: template.ord,
        sourceClozeOrdinal: model.cloze ? ordinal : undefined,
        sourceTemplateName: template.name,
        sourceFields,
        sourceDisplayedFields: [
          ...new Set([
            ...ankiTemplateFieldNames(template.question, model.fields),
            ...ankiTemplateFieldNames(template.answer, model.fields),
          ]),
        ],
        sourceFieldText,
        sourceFieldRaw,
        sourceState: {
          cardType: Number(row.card_type ?? 0),
          queue: Number(row.queue ?? 0),
          cardFlag: Number(row.card_flags ?? 0),
          noteFlag: Number(row.note_flags ?? 0),
        },
        front: parsedFront,
        back: semanticBack,
        tags,
      });
      decks.set(sourceDeckId, deck);
      options.onProgress?.({
        phase: "READING_CARDS",
        completed: rowIndex + 1,
        total: rows.length,
      });
      if ((rowIndex + 1) % 250 === 0) await yieldToMainThread();
    }
    if (![...decks.values()].some((deck) => deck.cards.length))
      throw new Error("Das Anki-Paket enthält keine importierbaren Karten.");
    const parsedDecks = sortAnkiDecksHierarchically([...decks.values()]);
    const roots = parsedDecks.map((deck) => deck.path[0]).filter(Boolean);
    const fallbackTitle =
      plainText(file.name.replace(/\.apkg$/i, "")).slice(0, 120) ||
      "Anki-Import";
    const collectionTitle =
      roots.length === parsedDecks.length && new Set(roots).size === 1
        ? roots[0]!
        : fallbackTitle;
    const parsed: ParsedAnkiPackage = {
      collectionTitle,
      decks: parsedDecks,
      media: media
        .filter(
          (item): item is LocalImportMedia & { kind: "image" | "audio" } =>
            item.kind !== "video",
        )
        .map((item) => ({
          sourceName: item.sourceName,
          data: item.bytes,
          mimeType: item.mimeType,
          extension: item.sourceName.split(".").at(-1)?.toLowerCase() ?? "bin",
          kind: item.kind,
        })),
      warnings: [...warnings].slice(0, 100),
      packageVersion: latest ? "latest" : "legacy",
      noteTypes: [...models.values()].map((model) => ({
        sourceNoteTypeId: model.id,
        name: model.name,
        isCloze: model.cloze,
        fields: model.fields,
        templates: model.templates.map((template) => ({
          ord: template.ord,
          name: template.name,
          questionFields: ankiTemplateFieldNames(
            template.question,
            model.fields,
          ),
          answerFields: ankiTemplateFieldNames(template.answer, model.fields),
        })),
      })),
    };
    const sourceCollectionKey = `anki-v2-${(
      await sha256Hex(
        new TextEncoder().encode(
          JSON.stringify(
            col.crt !== undefined && col.crt !== null
              ? { creationTime: String(col.crt) }
              : {
                  collectionTitle,
                  decks: parsedDecks
                    .map((deck) => ({
                      id: deck.sourceDeckId,
                      path: deck.path,
                    }))
                    .sort((left, right) => left.id.localeCompare(right.id)),
                  noteTypes: [...models.values()]
                    .map((model) => ({ id: model.id, name: model.name }))
                    .sort((left, right) => left.id.localeCompare(right.id)),
                },
          ),
        ),
      )
    ).slice(0, 32)}`;
    abortIfRequested(options.signal);
    options.onProgress?.({
      phase: "BUILDING_PREVIEW",
      completed: 0,
      total: 1,
    });
    const preview = createAnkiImportPreview(parsed, {
      sha256: "local",
      fileName: file.name,
      cached: false,
    });
    options.onProgress?.({
      phase: "BUILDING_PREVIEW",
      completed: 1,
      total: 1,
    });
    const resolvedDirection = {
      sourceLocale:
        languageDirection?.sourceLocale ??
        preview.xefjordPreset.suggestedSourceLocale ??
        "en",
      targetLocale:
        languageDirection?.targetLocale ??
        preview.xefjordPreset.suggestedTargetLocale ??
        "de",
    };
    const selectedMedia = options.includedMediaGroupIds
      ? selectedAnkiMediaNames(
          parsed,
          preview,
          options.includedMediaGroupIds,
          options.coverSourceName,
        )
      : null;
    if (options.includedSourceDeckIds) {
      selectAnkiSourceDecks(parsed, options.includedSourceDeckIds);
    }
    const mappings =
      options.mappings ??
      (preview.xefjordPreset.detected
        ? xefjordAnkiFieldMappings(preview)
        : suggestedAnkiFieldMappings(preview));
    abortIfRequested(options.signal);
    options.onProgress?.({
      phase: "APPLYING_PROFILE",
      completed: 0,
      total: 1,
    });
    const usesManualFieldMapping =
      options.profileSelection?.kind === "BUILT_IN" &&
      options.profileSelection.profileId === manualAnkiFieldMappingProfileId;
    const prepared =
      options.profileSelection?.kind === "CUSTOM"
        ? applyCustomAnkiImportProfile(
            parsed,
            options.profileSelection.profile,
            resolvedDirection,
          )
        : usesManualFieldMapping
          ? prepareAnkiFieldMappedPackage(parsed, mappings, resolvedDirection)
              .package
          : prepareAnkiCompatiblePackage(parsed, resolvedDirection, {
              includeReverseCards:
                options.includeReverseCards ||
                (options.profileSelection?.kind === "BUILT_IN" &&
                  options.profileSelection.profileId === xefjordAnkiProfileId),
            }).package;
    options.onProgress?.({
      phase: "APPLYING_PROFILE",
      completed: 1,
      total: 1,
    });
    const isXefjordProfile =
      options.profileSelection?.kind === "BUILT_IN" &&
      options.profileSelection.profileId === xefjordAnkiProfileId;
    if (
      isXefjordProfile ||
      (options.subdeckFields && Object.keys(options.subdeckFields).length)
    ) {
      const hierarchy = createAnkiImportHierarchy(
        prepared.collectionTitle,
        prepared.decks,
        options.subdeckFields ?? {},
        { flatten: isXefjordProfile },
      );
      const nodes = new Map(hierarchy.nodes.map((node) => [node.key, node]));
      const pathFor = (key: string): string[] => {
        const path: string[] = [];
        let current = nodes.get(key);
        while (current) {
          path.unshift(current.title);
          current = current.parentKey
            ? nodes.get(current.parentKey)
            : undefined;
        }
        return path;
      };
      const regrouped = new Map<string, ParsedAnkiPackage["decks"][number]>();
      for (const deck of prepared.decks) {
        for (const card of deck.cards) {
          const key =
            hierarchy.nodeKeyByCard.get(card) ??
            hierarchy.nodeKeyBySourceDeckId.get(deck.sourceDeckId) ??
            hierarchy.collectionKey;
          const path = pathFor(key);
          const grouped = regrouped.get(key) ?? {
            sourceDeckId: key,
            title: path.at(-1) ?? prepared.collectionTitle,
            path,
            cards: [],
          };
          grouped.cards.push(card);
          regrouped.set(key, grouped);
        }
      }
      prepared.decks = sortAnkiDecksHierarchically([...regrouped.values()]);
    }
    prepared.decks = sortAnkiDecksHierarchically(prepared.decks);
    return {
      title: prepared.collectionTitle,
      decks: prepared.decks.map((deck) => ({
        sourceId: deck.sourceDeckId,
        path: deck.path,
        cards: deck.cards.map((card) => ({
          ...completeAnkiCardSides(card),
          sourceId: card.sourceCardId ?? card.sourceNoteId,
          sourceNoteId: card.sourceNoteId,
          sourceNoteTypeId: card.sourceNoteTypeId,
          sourceNoteTypeName: card.sourceNoteTypeName,
          sourceTemplateOrd: card.sourceTemplateOrd,
          sourceClozeOrdinal: card.sourceClozeOrdinal,
          sourceTemplateName: card.sourceTemplateName,
          sourceOriginalTemplateOrd: card.sourceOriginalTemplateOrd,
          sourceOriginalTemplateName: card.sourceOriginalTemplateName,
          sourceNoteGuid: card.sourceNoteGuid,
          profileRuleId: card.profileRuleId,
          profileOutputId: card.profileOutputId,
          sourceFields: card.sourceFields,
          sourceDisplayedFields: card.sourceDisplayedFields,
          sourceTechnicalFields: card.sourceTechnicalFields,
          sourceFieldText: card.sourceFieldText,
          sourceFieldRaw: card.sourceFieldRaw,
          sourceState: card.sourceState,
          tags: card.tags,
          questionLocale: card.questionLocale,
          answerLocale: card.answerLocale,
          linkedToPrevious: card.linkedToPrevious,
          suspended: card.suspended,
        })),
      })),
      media: selectedMedia
        ? media.filter((item) => selectedMedia.has(item.sourceName))
        : media,
      warnings: prepared.warnings,
      format: "APKG",
      suggestedSourceLocale: resolvedDirection.sourceLocale,
      suggestedTargetLocale: resolvedDirection.targetLocale,
      ankiPreview: preview,
      coverSourceName: options.coverSourceName,
      importProfile: isXefjordProfile ? "XEFJORD" : undefined,
      sourceCollectionKey,
      packageSha256,
      profileId:
        options.profileSelection?.kind === "CUSTOM"
          ? options.profileSelection.profile.id
          : isXefjordProfile
            ? options.profileSelection?.profileId
            : usesManualFieldMapping
              ? manualAnkiFieldMappingProfileId
              : automaticAnkiTemplateProfileId,
      profileVersion:
        options.profileSelection?.kind === "CUSTOM"
          ? options.profileSelection.profile.schemaVersion
          : 1,
    };
  } finally {
    database.close();
  }
}

export async function parseLocalFlashNFlipPackage(
  file: File,
): Promise<LocalFileImport> {
  if (!/\.fnf$/i.test(file.name)) {
    throw new Error("Die Flash-n-Flip-Datei benötigt die Endung .fnf.");
  }
  if (file.size > maximumArchiveBytes)
    throw new Error("Die FNF-Datei ist zu groß.");
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    signature[2] === 0x03 &&
    signature[3] === 0x04
  ) {
    return parseLocalFlashNFlipV3Package(file);
  }
  const candidate = JSON.parse(await file.text()) as unknown;
  const parsed = localFlashNFlipPackageSchema.parse(candidate);
  const sourceNames = new Set<string>();
  const media = await Promise.all(
    parsed.media.map(async (entry) => {
      const safeName = safeMediaName(entry.sourceName);
      if (!safeName || sourceNames.has(safeName)) {
        throw new Error(
          "Das FNF-Paket enthält unsichere oder doppelte Mediennamen.",
        );
      }
      sourceNames.add(safeName);
      const bytes = Uint8Array.from(atob(entry.dataBase64), (character) =>
        character.charCodeAt(0),
      );
      if (bytes.byteLength <= 0 || bytes.byteLength > maximumMediaBytes) {
        throw new Error(
          `FNF-Medium überschreitet die Sicherheitsgrenze: ${entry.sourceName}`,
        );
      }
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== entry.sha256)
        throw new Error(`FNF-Medium beschädigt: ${entry.sourceName}`);
      const detected = mediaType(bytes, entry.sourceName);
      if (!detected || detected.mimeType !== entry.mimeType)
        throw new Error(`FNF-Medientyp ungültig: ${entry.sourceName}`);
      return { sourceName: safeName, bytes, ...detected };
    }),
  );
  return {
    title: parsed.title,
    decks: parsed.decks,
    media,
    warnings: [],
    format: "FNF",
  };
}

const parseLocalFlashNFlipV3Package = async (
  file: File,
): Promise<LocalFileImport> => {
  const { entries, sha256: packageSha256 } = await readArchive(file);
  const requiredEntry = (path: string): Uint8Array => {
    const bytes = entries.get(path);
    if (!bytes) throw new Error(`Das FNF-v3-Paket enthält ${path} nicht.`);
    return bytes;
  };
  if (decode(requiredEntry("mimetype")) !== fnfV3MimeType) {
    throw new Error("Das FNF-v3-Paket hat einen ungültigen Medientyp.");
  }
  let manifestCandidate: unknown;
  try {
    manifestCandidate = JSON.parse(decode(requiredEntry("manifest.json")));
  } catch {
    throw new Error("Das FNF-v3-Manifest ist kein gültiges JSON.");
  }
  const manifest = fnfV3ManifestSchema.parse(manifestCandidate);
  const supportedFeatures = new Set([
    "core-content-v1",
    "structured-blocks-v1",
    "mermaid-diagram-v1",
    "music-score-v1",
    "jsx-graph-v1",
    "reference-card-v1",
  ]);
  const unsupportedFeature = manifest.requiredFeatures.find(
    (feature) => !supportedFeatures.has(feature),
  );
  if (unsupportedFeature) {
    throw new Error(
      `Benötigtes FNF-v3-Feature wird nicht unterstützt: ${unsupportedFeature}`,
    );
  }
  if (manifest.profile !== "CONTENT_ONLY") {
    throw new Error(
      "FNF-v3-Lernfortschritte werden in dieser Version noch nicht importiert.",
    );
  }
  const declaredPaths = new Set(manifest.entries.map((entry) => entry.path));
  const actualPaths = new Set(
    [...entries.keys()].filter(
      (path) => path !== "mimetype" && path !== "manifest.json",
    ),
  );
  if (
    declaredPaths.size !== actualPaths.size ||
    [...declaredPaths].some((path) => !actualPaths.has(path))
  ) {
    throw new Error("FNF-v3-Manifest und Archivinhalt stimmen nicht überein.");
  }
  for (const entry of manifest.entries) {
    const bytes = requiredEntry(entry.path);
    if (
      bytes.byteLength !== entry.byteSize ||
      (await sha256Hex(bytes.slice().buffer)) !== entry.sha256
    ) {
      throw new Error(`FNF-v3-Eintrag ist beschädigt: ${entry.path}`);
    }
  }
  const parseJsonLines = <T>(
    path: string,
    schema: Parameters<typeof parseFnfV3JsonLines<T>>[1],
  ): T[] => parseFnfV3JsonLines(decode(requiredEntry(path)), schema, path);
  const decks = parseJsonLines("content/decks.jsonl", fnfV3DeckSchema);
  const notes = parseJsonLines("content/notes.jsonl", fnfV3NoteSchema);
  const cards = parseJsonLines("content/cards.jsonl", fnfV3CardSchema);
  const mediaRecords = parseJsonLines("content/media.jsonl", fnfV3MediaSchema);
  validateFnfV3ContentReferences({
    manifest,
    decks,
    notes,
    cards,
    media: mediaRecords,
  });
  if (cards.length > maximumCards) {
    throw new Error("Das FNF-v3-Paket enthält zu viele Karten.");
  }
  const media = await Promise.all(
    mediaRecords.map(async (entry) => {
      let bytes = requiredEntry(entry.path);
      if (bytes.byteLength <= 0 || bytes.byteLength > maximumMediaBytes) {
        throw new Error(
          `FNF-v3-Medium überschreitet die Sicherheitsgrenze: ${entry.id}`,
        );
      }
      const detectionName =
        entry.fileName ??
        (entry.mimeType === "video/mp4" ? "media.mp4" : "media.m4a");
      let detected = mediaType(bytes, detectionName);
      if (!detected && entry.mimeType === "image/svg+xml") {
        const sanitized = sanitizeSvgBytes(bytes);
        if (sanitized) {
          bytes = sanitized;
          detected = { mimeType: "image/svg+xml", kind: "image" };
        }
      }
      if (!detected || detected.mimeType !== entry.mimeType) {
        throw new Error(`FNF-v3-Medientyp ungültig: ${entry.id}`);
      }
      return { sourceName: entry.id, bytes, ...detected };
    }),
  );
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const pathFor = (deckId: string): string[] => {
    const path: string[] = [];
    let current = deckById.get(deckId);
    while (current) {
      path.unshift(current.title);
      current = current.parentId ? deckById.get(current.parentId) : undefined;
    }
    return path;
  };
  const rootId = manifest.roots[0];
  const root = rootId ? deckById.get(rootId) : undefined;
  if (!root) throw new Error("Das FNF-v3-Wurzel-Lernset fehlt.");
  return {
    title: root.title,
    decks: decks.map((deck) => ({
      sourceId: deck.id,
      path: pathFor(deck.id),
      cards: cards
        .filter((card) => card.deckId === deck.id)
        .sort((left, right) => left.position - right.position)
        .map((card) => ({
          sourceId: card.id,
          sourceNoteId: card.noteId,
          front: card.front,
          back: card.back,
          supplementalContent: card.supplementalContent,
          tags: card.tags,
          questionLocale: card.questionLocale ?? undefined,
          answerLocale: card.answerLocale ?? undefined,
          languageDirectionMode: card.languageDirectionMode,
          linkedToPrevious: card.linkedToPrevious,
          ratingEnabled: card.ratingEnabled,
          translations: card.translations,
          kind: card.kind,
          usage: card.usage,
          suspended: card.suspended,
        })),
      description: deck.description,
      language: deck.language,
      contentLocales: deck.contentLocales,
      defaultContentLocale: deck.defaultContentLocale,
      sourceLocale: deck.sourceLocale,
      targetLocale: deck.targetLocale,
      languageDirectionMode: deck.languageDirectionMode,
      sourceLocaleOverride: deck.sourceLocaleOverride,
      targetLocaleOverride: deck.targetLocaleOverride,
      studyOrder: deck.studyOrder,
      tags: deck.tags,
      visual: deck.visual,
      sourceTemplateKey: deck.sourceTemplateKey,
      contentStyles: deck.contentStyles,
    })),
    media,
    warnings: [],
    format: "FNF",
    sourceCollectionKey: manifest.lineageId,
    packageSha256,
  };
};

import { z } from "zod";

const importContentSchema = cardContentSchema.superRefine(
  (content, context) => {
    for (const [index, block] of content.blocks.entries()) {
      if (!block || typeof block !== "object") continue;
      if (
        (block as { type?: string }).type === "importImage" ||
        (block as { type?: string }).type === "importAudio"
      ) {
        context.addIssue({
          code: "custom",
          path: ["blocks", index],
          message: "FNF packages require UUID-backed media blocks",
        });
      }
    }
  },
);

const localFlashNFlipPackageSchema = z
  .object({
    format: z.literal("flash-n-flip.local-package"),
    version: z.literal(1),
    title: z.string().trim().min(1).max(120),
    decks: z
      .array(
        z.object({
          sourceId: z.string().min(1).max(200),
          path: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
          description: z.string().max(10_000).optional(),
          language: z.string().trim().min(2).max(16).optional(),
          contentLocales: z
            .array(z.string().trim().min(2).max(16))
            .min(1)
            .max(20)
            .optional(),
          defaultContentLocale: z.string().trim().min(2).max(16).optional(),
          sourceLocale: z.string().trim().min(2).max(16).optional(),
          targetLocale: z.string().trim().min(2).max(16).optional(),
          languageDirectionMode: z.enum(["OVERRIDE", "INHERIT"]).optional(),
          sourceLocaleOverride: z
            .string()
            .trim()
            .min(2)
            .max(16)
            .nullable()
            .optional(),
          targetLocaleOverride: z
            .string()
            .trim()
            .min(2)
            .max(16)
            .nullable()
            .optional(),
          studyOrder: z.enum(["SCHEDULED", "SEQUENTIAL"]).optional(),
          tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
          visual: z
            .discriminatedUnion("kind", [
              z.object({ kind: z.literal("IMAGE"), value: z.uuid() }).strict(),
              z
                .object({
                  kind: z.literal("MAP"),
                  value: z.string().trim().min(1).max(120),
                })
                .strict(),
            ])
            .nullable()
            .optional(),
          sourceTemplateKey: z.string().max(200).nullable().optional(),
          contentStyles: contentStyleDefinitionsSchema.optional(),
          cards: z
            .array(
              z.object({
                sourceId: z.string().min(1).max(200),
                sourceNoteId: z.string().min(1).max(200),
                front: importContentSchema,
                back: importContentSchema,
                tags: z.array(z.string().trim().min(1).max(40)).max(30),
                questionLocale: z.string().trim().min(2).max(16).optional(),
                answerLocale: z.string().trim().min(2).max(16).optional(),
                languageDirectionMode: z
                  .enum(["DECK_DEFAULT", "DECK_REVERSED", "CUSTOM"])
                  .optional(),
                linkedToPrevious: z.boolean().optional(),
                translations: localizedCardContentsSchema.optional(),
                kind: z.enum(["QUESTION", "EXPLANATION"]).optional(),
                suspended: z.boolean().optional(),
              }),
            )
            .max(maximumCards),
        }),
      )
      .min(1)
      .max(10_000),
    media: z
      .array(
        z.object({
          sourceName: z.string().trim().min(1).max(255),
          mimeType: z.string().trim().min(1).max(120),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          dataBase64: z
            .string()
            .min(1)
            .max(90_000_000)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
        }),
      )
      .max(10_000),
  })
  .strict();
