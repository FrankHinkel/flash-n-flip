import { assertSafeText } from "@flashcards/domain/content";

export type ImportedCard = {
  front: string;
  back: string;
  tags: string[];
};

const normalizeText = (value: string): string =>
  assertSafeText(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim(),
  );

const parseCsvRows = (input: string, delimiter: "," | "\t"): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (quoted) throw new Error("Unclosed quoted value");
  return rows;
};

export const parseCardImport = (
  input: string,
  format: "CSV" | "ANKI_TSV",
): ImportedCard[] => {
  if (input.length > 5_000_000) throw new Error("Import is too large");
  const rows = parseCsvRows(
    input.replace(/^\uFEFF/, ""),
    format === "CSV" ? "," : "\t",
  );
  const withoutHeader =
    rows[0]?.[0]?.trim().toLowerCase() === "front" ? rows.slice(1) : rows;
  if (withoutHeader.length > 10_000)
    throw new Error("Import has too many cards");
  return withoutHeader.map((row, index) => {
    const front = normalizeText(row[0] ?? "");
    const back = normalizeText(row[1] ?? "");
    if (!front || !back)
      throw new Error(`Card ${index + 1} needs front and back`);
    return {
      front,
      back,
      tags: (row[2] ?? "")
        .split(/[ ,]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 30),
    };
  });
};

const quoteCsv = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const createCsvExport = (cards: ImportedCard[]): string =>
  [
    ["front", "back", "tags"],
    ...cards.map((card) => [card.front, card.back, card.tags.join(" ")]),
  ]
    .map((row) => row.map(quoteCsv).join(","))
    .join("\r\n");
