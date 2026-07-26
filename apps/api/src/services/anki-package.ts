import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Decompress } from "fzstd";
import * as yauzl from "yauzl";

import { assertSafeText } from "@flashcards/domain/content";

import { detectSupportedMedia } from "./media-file.js";

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

export type AnkiContentBlock =
  | {
      type: "text";
      text: string;
      marks?: { bold?: boolean; italic?: boolean; code?: boolean };
    }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "formula"; latex: string }
  | AnkiMediaBlock;

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
    const detected = detectSupportedMedia(data, item.sourceName);
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

const safeDeckTitle = (value: string): string =>
  plainText(value)
    .replaceAll("::", " › ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Importiertes Anki-Deck";

export const parseAnkiPackage = async (
  archive: Buffer,
  options: { maximumMediaBytes: number },
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
      const front = htmlToContent(renderedFront, mediaByName, warnings);
      const back = htmlToContent(renderedBack, mediaByName, warnings);
      for (const block of [...front.blocks, ...back.blocks]) {
        if ("sourceName" in block) referencedMedia.add(block.sourceName);
      }
      const sourceDeckId =
        String(row.original_deck_id) !== "0"
          ? String(row.original_deck_id)
          : String(row.deck_id);
      const title = safeDeckTitle(
        parsedCollection.decks.get(sourceDeckId) ?? "Importiertes Anki-Deck",
      );
      const deck = decks.get(sourceDeckId) ?? {
        sourceDeckId,
        title,
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
    return {
      decks: [...decks.values()],
      media: parsedMedia.filter((item) => referencedMedia.has(item.sourceName)),
      warnings: [...warnings].slice(0, 100),
      packageVersion: version.latest ? "latest" : "legacy",
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};
