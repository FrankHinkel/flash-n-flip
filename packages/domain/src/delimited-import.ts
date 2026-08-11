import { assertSafeText } from "@flashcards/domain/content";

export type ImportedDelimitedCard = {
  front: string;
  back: string;
  tags: string[];
};

const normalizeText = (value: string): string =>
  assertSafeText(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .trim(),
  );

const parseRows = (input: string, delimiter: "," | "\t"): string[][] => {
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
  if (quoted) {
    throw new Error(
      "Eine Textzeile enthält ein nicht geschlossenes Anführungszeichen.",
    );
  }
  return rows;
};

export const parseDelimitedCards = (
  input: string,
  format?: "CSV" | "ANKI_TSV",
): ImportedDelimitedCard[] => {
  if (input.length > 5_000_000) {
    throw new Error("Die Importdatei ist größer als 5 MB.");
  }
  const normalized = input.replace(/^\uFEFF/, "");
  const resolvedFormat =
    format ??
    (normalized
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .find((line) => line.trim())
      ?.includes("\t")
      ? "ANKI_TSV"
      : "CSV");
  const rows = parseRows(normalized, resolvedFormat === "CSV" ? "," : "\t");
  const withoutHeader =
    rows[0]?.[0]?.trim().toLowerCase() === "front" ? rows.slice(1) : rows;
  if (withoutHeader.length > 10_000) {
    throw new Error("Der Textimport enthält mehr als 10.000 Karten.");
  }
  return withoutHeader.map((row, index) => {
    const front = normalizeText(row[0] ?? "");
    const back = normalizeText(row[1] ?? "");
    if (!front || !back) {
      throw new Error(
        `Zeile ${String(index + 1)} benötigt Vorder- und Rückseite.`,
      );
    }
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
