import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Decompress } from "fzstd";
import * as yauzl from "yauzl";

import { assertSafeText } from "@flashcards/domain/content";

import { detectSupportedMedia, sanitizeImportedSvg } from "./media-file.js";

const MAX_ARCHIVE_ENTRIES = 25_000;
const MAX_ARCHIVE_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_COLLECTION_BYTES = 96 * 1024 * 1024;
const MAX_CARDS = 50_000;
const MAX_TEXT_BLOCK_LENGTH = 10_000;
const MAX_ANKI_FIELD_LENGTH = 50_000;
const MAX_TEMPLATE_LENGTH = 100_000;
const MAX_RENDERED_HTML_LENGTH = 500_000;

type AnkiMediaBlock =
  | {
      type: "image";
      sourceName: string;
      alt: string;
      decorative: boolean;
    }
  | {
      type: "audio";
      sourceName: string;
      label: string;
      transcript?: string;
    };

type AnkiImageOverlayBlock = {
  type: "imageOverlay";
  baseSourceName: string;
  overlaySourceName: string;
  alt: string;
  decorative: boolean;
};

export type AnkiContentBlock =
  | {
      type: "text";
      text: string;
      marks?: { bold?: boolean; italic?: boolean; code?: boolean };
    }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "formula"; latex: string }
  | AnkiMediaBlock
  | AnkiImageOverlayBlock;

export type AnkiCardContent = { blocks: AnkiContentBlock[] };

export type ParsedAnkiCard = {
  sourceNoteId: string;
  front: AnkiCardContent;
  back: AnkiCardContent;
  tags: string[];
};

export type ParsedAnkiDeck = {
  sourceDeckId: string;
  title: string;
  path: string[];
  cards: ParsedAnkiCard[];
};

export type ParsedAnkiMedia = {
  sourceName: string;
  data: Buffer;
  mimeType: string;
  extension: string;
  kind: "image" | "audio";
};

export type ParsedAnkiPackage = {
  collectionTitle: string;
  decks: ParsedAnkiDeck[];
  media: ParsedAnkiMedia[];
  warnings: string[];
  packageVersion: "legacy" | "latest";
};

type ZipEntryMap = Map<string, Buffer>;

type ProtoValue = {
  field: number;
  wire: number;
  value: number | Uint8Array;
};

type AnkiTemplate = {
  ord: number;
  name: string;
  question: string;
  answer: string;
};

type AnkiModel = {
  id: string;
  name: string;
  isCloze: boolean;
  fields: string[];
  templates: AnkiTemplate[];
};

type SqliteCardRow = {
  card_id: number | bigint;
  note_id: number | bigint;
  deck_id: number | bigint;
  original_deck_id: number | bigint;
  ord: number;
  model_id: number | bigint;
  tags: string;
  fields: string;
};

const readZip = async (archive: Buffer): Promise<ZipEntryMap> =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      archive,
      {
        lazyEntries: true,
        decodeStrings: true,
        validateEntrySizes: true,
      },
      (openError, zip) => {
        if (openError || !zip) {
          reject(new Error("Die Datei ist kein gültiges Anki-Paket."));
          return;
        }
        const entries: ZipEntryMap = new Map();
        let entryCount = 0;
        let expandedBytes = 0;
        let settled = false;
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          zip.close();
          reject(error);
        };
        zip.on("error", (error) => fail(error));
        zip.on("end", () => {
          if (settled) return;
          settled = true;
          resolve(entries);
        });
        zip.on("entry", (entry) => {
          entryCount += 1;
          if (entryCount > MAX_ARCHIVE_ENTRIES) {
            fail(new Error("Das Anki-Paket enthält zu viele Dateien."));
            return;
          }
          const name = entry.fileName.normalize("NFC");
          if (
            !name ||
            name.includes("\0") ||
            name.includes("/") ||
            name.includes("\\") ||
            name === "." ||
            name === ".."
          ) {
            fail(
              new Error("Das Anki-Paket enthält einen unsicheren Dateipfad."),
            );
            return;
          }
          expandedBytes += entry.uncompressedSize;
          if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
            fail(
              new Error(
                "Das entpackte Anki-Paket überschreitet die Sicherheitsgrenze.",
              ),
            );
            return;
          }
          if (
            entry.compressedSize > 0 &&
            entry.uncompressedSize > 1024 * 1024 &&
            entry.uncompressedSize / entry.compressedSize > 250
          ) {
            fail(
              new Error(
                "Das Anki-Paket weist ein verdächtiges Kompressionsverhältnis auf.",
              ),
            );
            return;
          }
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail(
                streamError ??
                  new Error("Archivdatei kann nicht gelesen werden."),
              );
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > entry.uncompressedSize) {
                stream.destroy(
                  new Error("Archivdatei ist größer als im Paket angegeben."),
                );
                return;
              }
              chunks.push(Buffer.from(chunk));
            });
            stream.on("error", fail);
            stream.on("end", () => {
              if (settled) return;
              entries.set(name, Buffer.concat(chunks));
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });

const decompressZstd = (
  input: Buffer,
  maximumBytes: number,
  label: string,
): Buffer => {
  const chunks: Buffer[] = [];
  let size = 0;
  const decompressor = new Decompress((chunk) => {
    size += chunk.length;
    if (size > maximumBytes) {
      throw new Error(`${label} überschreitet die Sicherheitsgrenze.`);
    }
    chunks.push(Buffer.from(chunk));
  });
  decompressor.push(input, true);
  return Buffer.concat(chunks);
};

const readVarint = (
  input: Uint8Array,
  start: number,
): { value: number; next: number } => {
  let value = 0;
  let multiplier = 1;
  let offset = start;
  while (offset < input.length && offset - start < 10) {
    const byte = input[offset]!;
    value += (byte & 0x7f) * multiplier;
    offset += 1;
    if ((byte & 0x80) === 0) return { value, next: offset };
    multiplier *= 128;
  }
  throw new Error("Ungültige Protobuf-Variante im Anki-Paket.");
};

const readProto = (input: Uint8Array): ProtoValue[] => {
  const values: ProtoValue[] = [];
  let offset = 0;
  while (offset < input.length) {
    const key = readVarint(input, offset);
    offset = key.next;
    const field = Math.floor(key.value / 8);
    const wire = key.value % 8;
    if (field < 1) throw new Error("Ungültiges Protobuf-Feld.");
    if (wire === 0) {
      const value = readVarint(input, offset);
      offset = value.next;
      values.push({ field, wire, value: value.value });
    } else if (wire === 1) {
      if (offset + 8 > input.length) throw new Error("Defektes Protobuf-Feld.");
      values.push({ field, wire, value: input.subarray(offset, offset + 8) });
      offset += 8;
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
    } else if (wire === 5) {
      if (offset + 4 > input.length) throw new Error("Defektes Protobuf-Feld.");
      values.push({ field, wire, value: input.subarray(offset, offset + 4) });
      offset += 4;
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
  return value instanceof Uint8Array
    ? new TextDecoder("utf-8", { fatal: true }).decode(value)
    : "";
};

const packageVersion = (
  entries: ZipEntryMap,
): { latest: boolean; collectionName: string } => {
  const meta = entries.get("meta");
  if (meta) {
    const version = protoNumber(meta, 1);
    if (version === 3 && entries.has("collection.anki21b")) {
      return { latest: true, collectionName: "collection.anki21b" };
    }
    if (version && version > 3) {
      throw new Error("Dieses Anki-Paket ist neuer als der Importer.");
    }
  }
  if (entries.has("collection.anki21")) {
    return { latest: false, collectionName: "collection.anki21" };
  }
  if (entries.has("collection.anki2")) {
    return { latest: false, collectionName: "collection.anki2" };
  }
  throw new Error("Im Anki-Paket fehlt die Collection-Datenbank.");
};

const decodeLatestMediaManifest = (
  input: Buffer,
): Array<{
  zipName: string;
  sourceName: string;
  size: number;
  sha1?: Buffer;
}> =>
  readProto(input)
    .filter(
      (value) =>
        value.field === 1 &&
        value.wire === 2 &&
        value.value instanceof Uint8Array,
    )
    .map((value, index) => {
      const entry = readProto(value.value as Uint8Array);
      const nameValue = entry.find(
        (item) => item.field === 1 && item.wire === 2,
      )?.value;
      const sizeValue = entry.find(
        (item) => item.field === 2 && item.wire === 0,
      )?.value;
      const sha1Value = entry.find(
        (item) => item.field === 3 && item.wire === 2,
      )?.value;
      if (!(nameValue instanceof Uint8Array) || typeof sizeValue !== "number") {
        throw new Error("Das aktuelle Anki-Medienmanifest ist beschädigt.");
      }
      return {
        zipName: String(index),
        sourceName: new TextDecoder("utf-8", { fatal: true })
          .decode(nameValue)
          .normalize("NFC"),
        size: sizeValue,
        sha1:
          sha1Value instanceof Uint8Array ? Buffer.from(sha1Value) : undefined,
      };
    });

const decodeLegacyMediaManifest = (
  input: Buffer,
): Array<{
  zipName: string;
  sourceName: string;
  size?: number;
  sha1?: Buffer;
}> => {
  const parsed = JSON.parse(input.toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Das Anki-Medienmanifest ist beschädigt.");
  }
  return Object.entries(parsed).map(([zipName, sourceName]) => {
    if (!/^\d+$/.test(zipName) || typeof sourceName !== "string") {
      throw new Error("Das Anki-Medienmanifest ist beschädigt.");
    }
    return {
      zipName,
      sourceName: sourceName.normalize("NFC"),
    };
  });
};

const safeMediaName = (name: string): boolean =>
  Boolean(name) &&
  name.length <= 255 &&
  !name.includes("\0") &&
  !name.includes("/") &&
  !name.includes("\\") &&
  name !== "." &&
  name !== "..";

const parseMedia = (
  entries: ZipEntryMap,
  latest: boolean,
  maximumMediaBytes: number,
  warnings: Set<string>,
): ParsedAnkiMedia[] => {
  const manifestFile = entries.get("media");
  if (!manifestFile) return [];
  const manifestData = latest
    ? decompressZstd(manifestFile, 16 * 1024 * 1024, "Das Medienmanifest")
    : manifestFile;
  const manifest: Array<{
    zipName: string;
    sourceName: string;
    size?: number;
    sha1?: Buffer;
  }> = latest
    ? decodeLatestMediaManifest(manifestData)
    : decodeLegacyMediaManifest(manifestData);
  const media: ParsedAnkiMedia[] = [];
  let sanitizedSvgCount = 0;
  for (const item of manifest) {
    if (!safeMediaName(item.sourceName)) {
      warnings.add("Mindestens ein unsicherer Medienname wurde ausgelassen.");
      continue;
    }
    const archived = entries.get(item.zipName);
    if (!archived) {
      warnings.add(`Mediendatei fehlt: ${item.sourceName}`);
      continue;
    }
    let data: Buffer;
    try {
      data = latest
        ? decompressZstd(
            archived,
            maximumMediaBytes,
            `Mediendatei ${item.sourceName}`,
          )
        : archived;
    } catch {
      warnings.add(`Mediendatei ist beschädigt: ${item.sourceName}`);
      continue;
    }
    if (data.length === 0 || data.length > maximumMediaBytes) {
      warnings.add(`Mediendatei ist zu groß: ${item.sourceName}`);
      continue;
    }
    if (item.size !== undefined && data.length !== item.size) {
      warnings.add(`Mediendatei hat eine falsche Größe: ${item.sourceName}`);
      continue;
    }
    if (
      item.sha1 &&
      !createHash("sha1").update(data).digest().equals(item.sha1)
    ) {
      warnings.add(
        `Mediendatei hat eine falsche Prüfsumme: ${item.sourceName}`,
      );
      continue;
    }
    let detected = detectSupportedMedia(data, item.sourceName);
    if (!detected && /\.svg$/i.test(item.sourceName)) {
      const sanitized = sanitizeImportedSvg(data);
      if (!sanitized) {
        warnings.add(`Unsichere SVG-Grafik ausgelassen: ${item.sourceName}`);
        continue;
      }
      data = sanitized;
      detected = {
        mimeType: "image/svg+xml",
        extension: "svg",
        kind: "image",
      };
      sanitizedSvgCount += 1;
    }
    if (!detected) {
      warnings.add(
        `Nicht unterstütztes Medium ausgelassen: ${item.sourceName}`,
      );
      continue;
    }
    if (detected.kind === "video") {
      warnings.add(`Videodatei aus Anki-Paket ausgelassen: ${item.sourceName}`);
      continue;
    }
    media.push({
      sourceName: item.sourceName,
      data,
      mimeType: detected.mimeType,
      extension: detected.extension,
      kind: detected.kind === "image" ? "image" : "audio",
    });
  }
  if (sanitizedSvgCount > 0) {
    warnings.add(
      `${sanitizedSvgCount} SVG-Grafiken wurden geprüft und sicher als Vektorgrafiken importiert.`,
    );
  }
  return media;
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number(decimal)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexadecimal: string) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16)),
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
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:div|p|li|tr|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizedMediaReference = (value: string): string | null => {
  const decoded = decodeHtmlEntities(value).trim();
  if (
    !decoded ||
    /^(?:https?:|data:|javascript:|file:|\/\/)/i.test(decoded) ||
    decoded.includes("/") ||
    decoded.includes("\\")
  ) {
    return null;
  }
  try {
    return decodeURIComponent(decoded).normalize("NFC");
  } catch {
    return decoded.normalize("NFC");
  }
};

const splitTextBlocks = (value: string): AnkiContentBlock[] => {
  const safe = assertSafeText(value);
  const blocks: AnkiContentBlock[] = [];
  for (let offset = 0; offset < safe.length; offset += MAX_TEXT_BLOCK_LENGTH) {
    const text = safe.slice(offset, offset + MAX_TEXT_BLOCK_LENGTH).trim();
    if (text) blocks.push({ type: "text", text });
  }
  return blocks;
};

const htmlToContent = (
  html: string,
  availableMedia: Map<string, ParsedAnkiMedia>,
  warnings: Set<string>,
): AnkiCardContent => {
  const mediaBlocks: AnkiMediaBlock[] = [];
  const marker = (block: AnkiMediaBlock): string => {
    const index = mediaBlocks.push(block) - 1;
    return `\u0000ANKI_MEDIA_${index}\u0000`;
  };
  const withoutExecutableContent = html
    .replace(
      /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*(script|style|iframe|object|embed|form|svg)\b[^>]*\/?\s*>/gi,
      "",
    );
  const withImageMarkers = withoutExecutableContent.replace(
    /<img\b[^>]*>/gi,
    (tag) => {
      const source =
        tag.match(/\bsrc\s*=\s*"([^"]*)"/i)?.[1] ??
        tag.match(/\bsrc\s*=\s*'([^']*)'/i)?.[1] ??
        tag.match(/\bsrc\s*=\s*([^\s>]+)/i)?.[1] ??
        "";
      const name = normalizedMediaReference(source);
      if (!name || availableMedia.get(name)?.kind !== "image") {
        warnings.add(
          name
            ? `Referenziertes Bild fehlt oder wird nicht unterstützt: ${name}`
            : "Ein externes oder unsicher referenziertes Bild wurde ausgelassen.",
        );
        return "";
      }
      const alt =
        tag.match(/\balt\s*=\s*"([^"]*)"/i)?.[1] ??
        tag.match(/\balt\s*=\s*'([^']*)'/i)?.[1] ??
        "";
      return marker({
        type: "image",
        sourceName: name,
        alt: decodeHtmlEntities(alt).trim().slice(0, 500),
        decorative: !alt.trim(),
      });
    },
  );
  const withAllMarkers = withImageMarkers.replace(
    /\[sound:([^\]\r\n]+)\]/gi,
    (_token, source: string) => {
      const name = normalizedMediaReference(source);
      if (!name || availableMedia.get(name)?.kind !== "audio") {
        warnings.add(
          name
            ? `Referenziertes Audio fehlt oder wird nicht unterstützt: ${name}`
            : "Ein unsicher referenziertes Audio wurde ausgelassen.",
        );
        return "";
      }
      return marker({
        type: "audio",
        sourceName: name,
        label: `Audio: ${name}`.slice(0, 300),
      });
    },
  );
  const blocks: AnkiContentBlock[] = [];
  const markerPattern = /\u0000ANKI_MEDIA_(\d+)\u0000/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = markerPattern.exec(withAllMarkers))) {
    const text = plainText(withAllMarkers.slice(cursor, match.index));
    if (text) blocks.push(...splitTextBlocks(text));
    const mediaBlock = mediaBlocks[Number(match[1])];
    if (mediaBlock) blocks.push(mediaBlock);
    cursor = match.index + match[0].length;
  }
  const trailingText = plainText(withAllMarkers.slice(cursor));
  if (trailingText) blocks.push(...splitTextBlocks(trailingText));
  if (!blocks.length) {
    blocks.push({ type: "text", text: "Nicht unterstützter Anki-Inhalt." });
  }
  return { blocks: blocks.slice(0, 200) };
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderCloze = (value: string, target: number, answer: boolean): string =>
  value.replace(
    /\{\{c(\d+)::([\s\S]*?)(?:::(.*?))?\}\}/gi,
    (_match, rawNumber: string, text: string, hint?: string) => {
      if (Number(rawNumber) !== target) return text;
      if (answer) return text;
      return `[${hint?.trim() || "…"}]`;
    },
  );

const renderTemplate = (
  template: string,
  fields: Map<string, string>,
  cardOrdinal: number,
  answer: boolean,
  frontSide = "",
): string => {
  let rendered = template.slice(0, MAX_TEMPLATE_LENGTH);
  for (const [name, value] of fields) {
    const escaped = escapeRegExp(name);
    rendered = rendered
      .replace(
        new RegExp(`{{#${escaped}}}([\\s\\S]*?){{/${escaped}}}`, "gi"),
        plainText(value) ? "$1" : "",
      )
      .replace(
        new RegExp(`{{\\^${escaped}}}([\\s\\S]*?){{/${escaped}}}`, "gi"),
        plainText(value) ? "" : "$1",
      );
  }
  let remainingExpansion = MAX_RENDERED_HTML_LENGTH - rendered.length;
  const expanded = rendered.replace(
    /{{([^{}]+)}}/g,
    (_token, expression: string) => {
      const trimmed = expression.trim();
      let replacement = "";
      if (trimmed === "FrontSide") {
        replacement = frontSide;
      } else {
        const parts = trimmed.split(":");
        const fieldName = parts.at(-1)?.trim() ?? "";
        const value = fields.get(fieldName) ?? "";
        if (parts.some((part) => part.trim().toLowerCase() === "cloze")) {
          replacement = renderCloze(value, cardOrdinal + 1, answer);
        } else if (parts.some((part) => part.trim().toLowerCase() === "text")) {
          replacement = plainText(value);
        } else if (parts.some((part) => part.trim().toLowerCase() === "type")) {
          replacement = "";
        } else {
          replacement = value;
        }
      }
      if (remainingExpansion <= 0) return "";
      const limited = replacement.slice(0, remainingExpansion);
      remainingExpansion -= limited.length;
      return limited;
    },
  );
  return expanded.slice(0, MAX_RENDERED_HTML_LENGTH);
};

const dynamicTemplatePattern = /<\s*script\b|(?:^|\s)on[a-z]+\s*=/i;
const exampleFieldPattern =
  /beispiel|example|sentence|satz|sätze|phrase|context/i;
const unsupportedDetailFieldPattern =
  /conjug|konjug|grammar|grammatik|notiz|notes?|library|bibliothek/i;
const metadataFieldPattern =
  /^(?:id|guid|deck\s*id|rank|rang|dispersion|sort|version|modified|updated?)$/i;

const normalizedFieldName = (value: string): string =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();

const referencedFieldNames = (
  template: string,
  fields: Map<string, string>,
): string[] => {
  const actualByNormalizedName = new Map(
    [...fields.keys()].map((name) => [normalizedFieldName(name), name]),
  );
  const names: string[] = [];
  for (const token of template.matchAll(/{{([^{}]+)}}/g)) {
    const expression = token[1]!.trim().replace(/^[#^/]/, "");
    const candidate = expression.split(":").at(-1)?.trim() ?? "";
    const actual = actualByNormalizedName.get(normalizedFieldName(candidate));
    if (actual && !names.includes(actual)) names.push(actual);
  }
  return names;
};

const firstDynamicFieldRecord = (value: string): string => {
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return (
    normalized
      .split(/(?:\n[ \t]*){2,}|(?:<br\s*\/?>\s*){2,}|<\/p>\s*<p\b[^>]*>/i)
      .find((part) => plainText(part)) ?? normalized
  )
    .replace(/\*([^*\n]+)\*/g, "$1")
    .trim();
};

const dynamicBackFieldPriority = (name: string): number => {
  const normalized = normalizedFieldName(name);
  if (
    /answer|back|definition|meaning|translation|bedeutung|ubersetz/.test(
      normalized,
    )
  ) {
    return 0;
  }
  if (/word|wort|term|lemma|front|question|frage/.test(normalized)) return 1;
  if (/fem|plural|article|artikel|variant|form/.test(normalized)) return 2;
  if (/ipa|pronun|aussprache/.test(normalized)) return 3;
  if (/audio|sound/.test(normalized)) return 4;
  if (/part.*speech|wortart|pos|register/.test(normalized)) return 5;
  if (exampleFieldPattern.test(normalized)) return 6;
  return 7;
};

const appendUniqueBlocks = (
  target: AnkiContentBlock[],
  content: AnkiCardContent,
  seenText: Set<string>,
): void => {
  for (const block of content.blocks) {
    if (block.type === "text" || block.type === "heading") {
      const normalized = block.text.replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalized || seenText.has(normalized)) continue;
      seenText.add(normalized);
    }
    target.push(block);
  }
};

const firstImageBlock = (
  value: string,
  availableMedia: Map<string, ParsedAnkiMedia>,
  warnings: Set<string>,
): Extract<AnkiMediaBlock, { type: "image" }> | null =>
  htmlToContent(value, availableMedia, warnings).blocks.find(
    (block): block is Extract<AnkiMediaBlock, { type: "image" }> =>
      block.type === "image",
  ) ?? null;

const normalizedFieldMap = (fields: Map<string, string>): Map<string, string> =>
  new Map(
    [...fields].map(([name, value]) => [normalizedFieldName(name), value]),
  );

type RegisterSyntheticSvg = (
  sourceName: string,
  source: string,
) => string | null;

type ImageOcclusionRect = {
  cloze: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

const rasterDimensions = (
  media: ParsedAnkiMedia,
): { width: number; height: number } | null => {
  const { data, mimeType } = media;
  if (mimeType === "image/png" && data.length >= 24) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (mimeType !== "image/jpeg" || data.length < 4) return null;
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = data.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > data.length) return null;
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        width: data.readUInt16BE(offset + 7),
        height: data.readUInt16BE(offset + 5),
      };
    }
    offset += length + 2;
  }
  return null;
};

const parseImageOcclusionRects = (value: string): ImageOcclusionRect[] => {
  const rectangles: ImageOcclusionRect[] = [];
  const pattern =
    /\{\{c(\d+)::image-occlusion:rect:left=([^:}]*):top=([^:}]*):width=([^:}]*):height=([^:}]*):oi=\d+\}\}/gi;
  for (const match of value.matchAll(pattern)) {
    const rectangle = {
      cloze: Number(match[1]),
      left: Number(match[2]),
      top: Number(match[3]),
      width: Number(match[4]),
      height: Number(match[5]),
    };
    if (
      Number.isInteger(rectangle.cloze) &&
      rectangle.cloze > 0 &&
      [rectangle.left, rectangle.top, rectangle.width, rectangle.height].every(
        Number.isFinite,
      ) &&
      rectangle.left >= 0 &&
      rectangle.top >= 0 &&
      rectangle.width > 0 &&
      rectangle.height > 0 &&
      rectangle.left + rectangle.width <= 1.01 &&
      rectangle.top + rectangle.height <= 1.01
    ) {
      rectangles.push(rectangle);
    }
  }
  return rectangles;
};

const imageOcclusionSvg = (
  rectangles: ImageOcclusionRect[],
  target: number,
  dimensions: { width: number; height: number },
  answer: boolean,
): string => {
  const scale = (value: number, size: number) =>
    Number((value * size).toFixed(4));
  const shapes = rectangles
    .map((rectangle) => {
      const position = `x="${scale(rectangle.left, dimensions.width)}" y="${scale(rectangle.top, dimensions.height)}" width="${scale(rectangle.width, dimensions.width)}" height="${scale(rectangle.height, dimensions.height)}"`;
      if (answer && rectangle.cloze === target) {
        return `<rect ${position} fill="none" stroke="#ff7e7e" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
      }
      const fill = rectangle.cloze === target ? "#ff7e7e" : "#ffeba2";
      return `<rect ${position} fill="${fill}" stroke="#2d2d2d" stroke-width="1"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" preserveAspectRatio="none">${shapes}</svg>`;
};

const renderNativeImageOcclusionFallback = (
  model: AnkiModel,
  fields: Map<string, string>,
  cardOrdinal: number,
  sourceNoteId: string,
  availableMedia: Map<string, ParsedAnkiMedia>,
  warnings: Set<string>,
  registerSyntheticSvg: RegisterSyntheticSvg,
): { front: AnkiCardContent; back: AnkiCardContent } | null => {
  if (!model.isCloze || !/image occlusion/i.test(model.name)) return null;
  const normalized = normalizedFieldMap(fields);
  const base = firstImageBlock(
    normalized.get("image") ?? "",
    availableMedia,
    warnings,
  );
  if (!base) return null;
  const baseMedia = availableMedia.get(base.sourceName);
  const dimensions = baseMedia ? rasterDimensions(baseMedia) : null;
  const rectangles = parseImageOcclusionRects(
    normalized.get("occlusion") ?? "",
  );
  const target = cardOrdinal + 1;
  if (
    !dimensions ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    !rectangles.some((rectangle) => rectangle.cloze === target)
  ) {
    return null;
  }
  const prefix = `flash-n-flip-io-${sourceNoteId}-${target}`;
  const questionMask = registerSyntheticSvg(
    `${prefix}-Q.svg`,
    imageOcclusionSvg(rectangles, target, dimensions, false),
  );
  const answerMask = registerSyntheticSvg(
    `${prefix}-A.svg`,
    imageOcclusionSvg(rectangles, target, dimensions, true),
  );
  if (!questionMask || !answerMask) return null;
  const textBlocks = (names: string[]): AnkiContentBlock[] =>
    names.flatMap((name) => {
      const text = plainText(normalized.get(name) ?? "");
      return text ? splitTextBlocks(text) : [];
    });
  const overlay = (sourceName: string): AnkiImageOverlayBlock => ({
    type: "imageOverlay",
    baseSourceName: base.sourceName,
    overlaySourceName: sourceName,
    alt: base.alt || "Image occlusion",
    decorative: false,
  });
  warnings.add(
    `Koordinatenbasierte Bildabdeckung aus „${model.name}“ wurde als sicheres Vektor-Overlay importiert.`,
  );
  return {
    front: {
      blocks: [...textBlocks(["header"]), overlay(questionMask)],
    },
    back: {
      blocks: [
        ...textBlocks(["header"]),
        overlay(answerMask),
        ...textBlocks([
          "comments",
          "attached",
          "back extra",
          "back extra 2",
          "back extra 3",
        ]),
      ],
    },
  };
};

const renderImageOcclusionFallback = (
  model: AnkiModel,
  fields: Map<string, string>,
  availableMedia: Map<string, ParsedAnkiMedia>,
  warnings: Set<string>,
): { front: AnkiCardContent; back: AnkiCardContent } | null => {
  if (!/image occlusion/i.test(model.name)) return null;
  const normalized = normalizedFieldMap(fields);
  const base = firstImageBlock(
    normalized.get("image") ?? "",
    availableMedia,
    warnings,
  );
  const questionMask = firstImageBlock(
    normalized.get("question mask") ?? "",
    availableMedia,
    warnings,
  );
  const answerMask = firstImageBlock(
    normalized.get("answer mask") ?? normalized.get("original mask") ?? "",
    availableMedia,
    warnings,
  );
  if (!base || !questionMask || !answerMask) return null;

  const overlay = (
    mask: Extract<AnkiMediaBlock, { type: "image" }>,
  ): AnkiImageOverlayBlock => ({
    type: "imageOverlay",
    baseSourceName: base.sourceName,
    overlaySourceName: mask.sourceName,
    alt: base.alt || "Image occlusion",
    decorative: false,
  });
  const textBlocks = (names: string[]): AnkiContentBlock[] =>
    names.flatMap((name) => {
      const text = plainText(normalized.get(name) ?? "");
      return text ? splitTextBlocks(text) : [];
    });
  warnings.add(
    `Bildabdeckungs-Vorlage „${model.name}“ wurde als sicheres Bild-Overlay importiert.`,
  );
  return {
    front: {
      blocks: [
        ...textBlocks(["header"]),
        overlay(questionMask),
        ...textBlocks(["footer"]),
      ],
    },
    back: {
      blocks: [
        ...textBlocks(["header"]),
        overlay(answerMask),
        ...textBlocks(["footer", "remarks", "sources", "extra 1", "extra 2"]),
      ],
    },
  };
};

const unwrapOverlappingGroups = (value: string): string => {
  let result = value;
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const unwrapped = result.replace(/\[\[r\d*::([\s\S]*?)\]\]/gi, "$1");
    if (unwrapped === result) return result;
    result = unwrapped;
  }
  return result;
};

const renderDynamicClozeFallback = (
  model: AnkiModel,
  fields: Map<string, string>,
  cardOrdinal: number,
  availableMedia: Map<string, ParsedAnkiMedia>,
  warnings: Set<string>,
): { front: AnkiCardContent; back: AnkiCardContent } | null => {
  if (!model.isCloze) return null;
  const normalized = normalizedFieldMap(fields);
  const primaryField =
    normalized.get("text") ??
    normalized.get("front") ??
    [...fields.values()].find((value) => /\{\{c\d+::/i.test(value));
  if (!primaryField) return null;
  const source = unwrapOverlappingGroups(primaryField);
  const target = cardOrdinal + 1;
  const front = htmlToContent(
    renderCloze(source, target, false),
    availableMedia,
    warnings,
  );
  const back = htmlToContent(
    renderCloze(source, target, true),
    availableMedia,
    warnings,
  );
  const seenText = new Set(
    back.blocks
      .filter(
        (
          block,
        ): block is Extract<AnkiContentBlock, { type: "text" | "heading" }> =>
          block.type === "text" || block.type === "heading",
      )
      .map((block) => block.text.replace(/\s+/g, " ").trim().toLowerCase()),
  );
  for (const name of [
    "answer",
    "attached",
    "back extra",
    "back extra 2",
    "back extra 3",
    "back extra 4",
    "back extra 5",
    "back extra 6",
    "back extra 7",
    "back extra 8",
    "back extra 9",
    "back extra 10",
  ]) {
    const value = normalized.get(name);
    if (!plainText(value ?? "")) continue;
    appendUniqueBlocks(
      back.blocks,
      htmlToContent(value!, availableMedia, warnings),
      seenText,
    );
  }
  warnings.add(
    `Dynamische Lückentext-Vorlage „${model.name}“ wurde pro Karte sicher und vollständig aufgelöst.`,
  );
  return { front, back: { blocks: back.blocks.slice(0, 200) } };
};

const renderDynamicTemplateFallback = (
  model: AnkiModel,
  template: AnkiTemplate,
  fields: Map<string, string>,
  cardOrdinal: number,
  sourceNoteId: string,
  availableMedia: Map<string, ParsedAnkiMedia>,
  warnings: Set<string>,
  registerSyntheticSvg: RegisterSyntheticSvg,
): { front: AnkiCardContent; back: AnkiCardContent } => {
  const nativeImageOcclusion = renderNativeImageOcclusionFallback(
    model,
    fields,
    cardOrdinal,
    sourceNoteId,
    availableMedia,
    warnings,
    registerSyntheticSvg,
  );
  if (nativeImageOcclusion) return nativeImageOcclusion;
  const imageOcclusion = renderImageOcclusionFallback(
    model,
    fields,
    availableMedia,
    warnings,
  );
  if (imageOcclusion) return imageOcclusion;
  const cloze = renderDynamicClozeFallback(
    model,
    fields,
    cardOrdinal,
    availableMedia,
    warnings,
  );
  if (cloze) return cloze;
  const questionFields = referencedFieldNames(template.question, fields);
  const primaryQuestionField =
    questionFields.find((name) => {
      const normalized = normalizedFieldName(name);
      return (
        !exampleFieldPattern.test(normalized) &&
        !unsupportedDetailFieldPattern.test(normalized) &&
        !metadataFieldPattern.test(normalized) &&
        plainText(fields.get(name) ?? "")
      );
    }) ??
    model.fields.find(
      (name) =>
        !metadataFieldPattern.test(normalizedFieldName(name)) &&
        plainText(fields.get(name) ?? ""),
    );
  const primaryValue = primaryQuestionField
    ? (fields.get(primaryQuestionField) ?? "")
    : "";
  const front = htmlToContent(
    primaryQuestionField &&
      exampleFieldPattern.test(normalizedFieldName(primaryQuestionField))
      ? firstDynamicFieldRecord(primaryValue)
      : primaryValue,
    availableMedia,
    warnings,
  );
  const frontText = new Set(
    front.blocks
      .filter(
        (
          block,
        ): block is Extract<AnkiContentBlock, { type: "text" | "heading" }> =>
          block.type === "text" || block.type === "heading",
      )
      .map((block) => block.text.replace(/\s+/g, " ").trim().toLowerCase()),
  );
  const answerFields = referencedFieldNames(template.answer, fields)
    .filter((name) => {
      const normalized = normalizedFieldName(name);
      return (
        !unsupportedDetailFieldPattern.test(normalized) &&
        !metadataFieldPattern.test(normalized) &&
        plainText(fields.get(name) ?? "")
      );
    })
    .sort(
      (left, right) =>
        dynamicBackFieldPriority(left) - dynamicBackFieldPriority(right),
    );
  const backBlocks: AnkiContentBlock[] = [];
  const seenText = new Set(frontText);
  for (const name of answerFields) {
    const normalized = normalizedFieldName(name);
    const rawValue = fields.get(name) ?? "";
    if (
      dynamicBackFieldPriority(name) === 7 &&
      plainText(rawValue).length > MAX_TEXT_BLOCK_LENGTH
    ) {
      continue;
    }
    const value = exampleFieldPattern.test(normalized)
      ? firstDynamicFieldRecord(rawValue)
      : rawValue;
    appendUniqueBlocks(
      backBlocks,
      htmlToContent(value, availableMedia, warnings),
      seenText,
    );
    if (backBlocks.length >= 12) break;
  }
  warnings.add(
    `JavaScript-abhängige Kartenvorlage „${template.name}“ aus „${model.name}“ wurde sicher und kompakt importiert.`,
  );
  return {
    front,
    back:
      backBlocks.length > 0
        ? { blocks: backBlocks }
        : { blocks: [{ type: "text", text: "Keine statische Antwort." }] },
  };
};

const asBuffer = (value: unknown): Buffer =>
  Buffer.isBuffer(value)
    ? value
    : value instanceof Uint8Array
      ? Buffer.from(value)
      : Buffer.alloc(0);

const parseLegacyModels = (
  raw: string,
): { models: Map<string, AnkiModel>; decks: Map<string, string> } => {
  const databaseModels = JSON.parse(raw) as Record<
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
  const models = new Map<string, AnkiModel>();
  for (const [key, model] of Object.entries(databaseModels)) {
    models.set(String(model.id ?? key), {
      id: String(model.id ?? key),
      name: model.name ?? "Anki-Notiztyp",
      isCloze: model.type === 1,
      fields: [...(model.flds ?? [])]
        .sort((left, right) => (left.ord ?? 0) - (right.ord ?? 0))
        .map((field) => field.name ?? "Feld"),
      templates: [...(model.tmpls ?? [])]
        .sort((left, right) => (left.ord ?? 0) - (right.ord ?? 0))
        .map((template, index) => ({
          ord: template.ord ?? index,
          name: template.name ?? `Karte ${index + 1}`,
          question: template.qfmt ?? "",
          answer: template.afmt ?? "",
        })),
    });
  }
  return { models, decks: new Map() };
};

const readCollection = (
  databasePath: string,
): {
  models: Map<string, AnkiModel>;
  decks: Map<string, string>;
  rows: SqliteCardRow[];
} => {
  const sqlite = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const collection = sqlite
      .prepare("SELECT ver, models, decks FROM col LIMIT 1")
      .get() as { ver: number; models: string; decks: string } | undefined;
    if (!collection) throw new Error("Die Anki-Collection ist leer.");
    let models: Map<string, AnkiModel>;
    let deckNames: Map<string, string>;
    if (collection.ver >= 15) {
      models = new Map();
      const notetypes = sqlite
        .prepare("SELECT id, name, config FROM notetypes")
        .all() as Array<{ id: number | bigint; name: string; config: unknown }>;
      const fieldRows = sqlite
        .prepare("SELECT ntid, ord, name FROM fields ORDER BY ntid, ord")
        .all() as Array<{
        ntid: number | bigint;
        ord: number;
        name: string;
      }>;
      const templateRows = sqlite
        .prepare(
          "SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord",
        )
        .all() as Array<{
        ntid: number | bigint;
        ord: number;
        name: string;
        config: unknown;
      }>;
      for (const notetype of notetypes) {
        const id = String(notetype.id);
        models.set(id, {
          id,
          name: notetype.name,
          isCloze: protoNumber(asBuffer(notetype.config), 1) === 1,
          fields: fieldRows
            .filter((field) => String(field.ntid) === id)
            .map((field) => field.name),
          templates: templateRows
            .filter((template) => String(template.ntid) === id)
            .map((template) => {
              const config = asBuffer(template.config);
              return {
                ord: template.ord,
                name: template.name,
                question: protoString(config, 1),
                answer: protoString(config, 2),
              };
            }),
        });
      }
      deckNames = new Map(
        (
          sqlite.prepare("SELECT id, name FROM decks").all() as Array<{
            id: number | bigint;
            name: string;
          }>
        ).map((deck) => [String(deck.id), deck.name]),
      );
    } else {
      const legacy = parseLegacyModels(collection.models);
      models = legacy.models;
      const rawDecks = JSON.parse(collection.decks) as Record<
        string,
        { id?: number; name?: string }
      >;
      deckNames = new Map(
        Object.entries(rawDecks).map(([id, deck]) => [
          String(deck.id ?? id),
          deck.name ?? "Anki-Deck",
        ]),
      );
    }
    const rows = sqlite
      .prepare(
        `SELECT
          c.id AS card_id,
          n.id AS note_id,
          c.did AS deck_id,
          c.odid AS original_deck_id,
          c.ord AS ord,
          n.mid AS model_id,
          n.tags AS tags,
          n.flds AS fields
        FROM cards c
        INNER JOIN notes n ON n.id = c.nid
        ORDER BY c.id
        LIMIT ?`,
      )
      .all(MAX_CARDS + 1) as unknown as SqliteCardRow[];
    if (rows.length > MAX_CARDS) {
      throw new Error(`Das Anki-Paket enthält mehr als ${MAX_CARDS} Karten.`);
    }
    return { models, decks: deckNames, rows };
  } finally {
    sqlite.close();
  }
};

const safeDeckPath = (value: string): string[] =>
  value
    .split("::")
    .map((segment) =>
      plainText(segment).replace(/\s+/g, " ").trim().slice(0, 120),
    )
    .filter(Boolean);

const safeDeckTitle = (value: string): string =>
  safeDeckPath(value).join(" › ").slice(0, 120) || "Importiertes Anki-Deck";

const safeCollectionTitle = (
  decks: ParsedAnkiDeck[],
  fileName?: string,
): string => {
  const firstSegments = decks
    .map((deck) => deck.path[0])
    .filter((segment): segment is string => Boolean(segment));
  if (
    firstSegments.length === decks.length &&
    new Set(firstSegments).size === 1
  ) {
    return firstSegments[0]!;
  }
  const fromFile = plainText(fileName?.replace(/\.apkg$/i, "") ?? "")
    .replace(/^[_\s-]+|[_\s-]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return fromFile || "Importierte Anki-Collection";
};

export const parseAnkiPackage = async (
  archive: Buffer,
  options: { maximumMediaBytes: number; fileName?: string },
): Promise<ParsedAnkiPackage> => {
  const entries = await readZip(archive);
  const version = packageVersion(entries);
  const warnings = new Set<string>();
  const archivedCollection = entries.get(version.collectionName)!;
  const collection = version.latest
    ? decompressZstd(
        archivedCollection,
        MAX_COLLECTION_BYTES,
        "Die Anki-Collection",
      )
    : archivedCollection;
  if (
    collection.length < 16 ||
    collection.subarray(0, 16).toString("ascii") !== "SQLite format 3\u0000"
  ) {
    throw new Error("Die Anki-Collection ist keine gültige SQLite-Datenbank.");
  }
  const parsedMedia = parseMedia(
    entries,
    version.latest,
    options.maximumMediaBytes,
    warnings,
  );
  const mediaByName = new Map(
    parsedMedia.map((item) => [item.sourceName, item]),
  );
  const registerSyntheticSvg: RegisterSyntheticSvg = (sourceName, source) => {
    const existing = mediaByName.get(sourceName);
    if (existing)
      return existing.mimeType === "image/svg+xml" ? sourceName : null;
    const data = sanitizeImportedSvg(Buffer.from(source, "utf8"));
    if (!data) return null;
    const item: ParsedAnkiMedia = {
      sourceName,
      data,
      mimeType: "image/svg+xml",
      extension: "svg",
      kind: "image",
    };
    parsedMedia.push(item);
    mediaByName.set(sourceName, item);
    return sourceName;
  };
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "flashcards-apkg-"));
  try {
    const databasePath = join(temporaryDirectory, "collection.sqlite");
    await writeFile(databasePath, collection, { flag: "wx", mode: 0o600 });
    const parsedCollection = readCollection(databasePath);
    const decks = new Map<string, ParsedAnkiDeck>();
    const referencedMedia = new Set<string>();
    for (const row of parsedCollection.rows) {
      const model = parsedCollection.models.get(String(row.model_id));
      if (!model) {
        warnings.add(
          `Unbekannter Anki-Notiztyp ${String(row.model_id)} ausgelassen.`,
        );
        continue;
      }
      const template = model.isCloze
        ? model.templates[0]
        : model.templates.find((candidate) => candidate.ord === row.ord);
      if (!template) {
        warnings.add(`Fehlende Kartenvorlage in ${model.name} ausgelassen.`);
        continue;
      }
      const values = row.fields.split("\u001f");
      const fieldMap = new Map(
        model.fields.map((name, index) => [
          name,
          (values[index] ?? "").slice(0, MAX_ANKI_FIELD_LENGTH),
        ]),
      );
      let front: AnkiCardContent;
      let back: AnkiCardContent;
      if (
        dynamicTemplatePattern.test(template.question) ||
        dynamicTemplatePattern.test(template.answer)
      ) {
        ({ front, back } = renderDynamicTemplateFallback(
          model,
          template,
          fieldMap,
          row.ord,
          String(row.note_id),
          mediaByName,
          warnings,
          registerSyntheticSvg,
        ));
      } else {
        const renderedFront = renderTemplate(
          template.question,
          fieldMap,
          row.ord,
          false,
        );
        let renderedBack = renderTemplate(
          template.answer,
          fieldMap,
          row.ord,
          true,
          renderedFront,
        );
        const answerSeparator = renderedBack.match(
          /<hr\b[^>]*\bid\s*=\s*(?:"answer"|'answer'|answer)[^>]*>/i,
        );
        if (answerSeparator?.index !== undefined) {
          renderedBack = renderedBack.slice(
            answerSeparator.index + answerSeparator[0].length,
          );
        }
        front = htmlToContent(renderedFront, mediaByName, warnings);
        back = htmlToContent(renderedBack, mediaByName, warnings);
      }
      for (const block of [...front.blocks, ...back.blocks]) {
        if ("sourceName" in block) {
          referencedMedia.add(block.sourceName);
        } else if (block.type === "imageOverlay") {
          referencedMedia.add(block.baseSourceName);
          referencedMedia.add(block.overlaySourceName);
        }
      }
      const sourceDeckId =
        String(row.original_deck_id) !== "0"
          ? String(row.original_deck_id)
          : String(row.deck_id);
      const sourceDeckName =
        parsedCollection.decks.get(sourceDeckId) ?? "Importiertes Anki-Deck";
      const path = safeDeckPath(sourceDeckName);
      const title = safeDeckTitle(sourceDeckName);
      const deck = decks.get(sourceDeckId) ?? {
        sourceDeckId,
        title,
        path: path.length ? path : [title],
        cards: [],
      };
      deck.cards.push({
        sourceNoteId: String(row.note_id),
        front,
        back,
        tags: row.tags
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 30)
          .map((tag) => tag.slice(0, 80)),
      });
      decks.set(sourceDeckId, deck);
    }
    if (![...decks.values()].some((deck) => deck.cards.length)) {
      throw new Error("Das Anki-Paket enthält keine importierbaren Karten.");
    }
    const parsedDecks = [...decks.values()];
    return {
      collectionTitle: safeCollectionTitle(parsedDecks, options.fileName),
      decks: parsedDecks,
      media: parsedMedia.filter((item) => referencedMedia.has(item.sourceName)),
      warnings: [...warnings].slice(0, 100),
      packageVersion: version.latest ? "latest" : "legacy",
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};
