import {
  parseDelimitedCards,
  type ImportedDelimitedCard as ImportedCard,
} from "@flashcards/domain/delimited-import";

export type { ImportedCard };

export const parseCardImport = (
  input: string,
  format: "CSV" | "ANKI_TSV",
): ImportedCard[] => parseDelimitedCards(input, format);

const quoteCsv = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

export const createCsvExport = (cards: ImportedCard[]): string =>
  [
    ["front", "back", "tags"],
    ...cards.map((card) => [card.front, card.back, card.tags.join(" ")]),
  ]
    .map((row) => row.map(quoteCsv).join(","))
    .join("\r\n");
