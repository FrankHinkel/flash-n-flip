import { ApiError } from "@flashcards/api-client";

type Translate = (english: string, german: string) => string;

export const importErrorMessage = (
  cause: unknown,
  format: "FNF" | "CSV" | "ANKI_TSV" | "APKG",
  text: Translate,
): string => {
  if (
    format === "APKG" &&
    cause instanceof ApiError &&
    cause.status >= 500 &&
    cause.details === undefined
  ) {
    return text(
      "The Anki upload was interrupted by the web server. Please try again. If it keeps failing, check the server log using the time of this attempt.",
      "Der Anki-Upload wurde vom Webserver unterbrochen. Bitte versuche es erneut. Falls es wieder fehlschlägt, prüfe das Serverprotokoll anhand der Uhrzeit dieses Versuchs.",
    );
  }

  return cause instanceof Error
    ? cause.message
    : text("Import failed.", "Import fehlgeschlagen.");
};
