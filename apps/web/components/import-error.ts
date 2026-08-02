import { ApiError } from "@flashcards/api-client";

type Translate = (english: string, german: string) => string;

export const importErrorMessage = (
  cause: unknown,
  format: "FNF" | "CSV" | "ANKI_TSV" | "APKG",
  text: Translate,
): string => {
  if (format === "APKG" && cause instanceof ApiError) {
    if (cause.status === 0) {
      return text(
        "The connection was interrupted during the Anki import. No collection was saved. Check the connection and start the import again.",
        "Die Verbindung wurde während des Anki-Imports unterbrochen. Es wurde keine Sammlung gespeichert. Prüfe die Verbindung und starte den Import erneut.",
      );
    }
    if (cause.status === 413) {
      return text(
        "The Anki package exceeds the 256 MB upload limit. Export a smaller package or split the collection in Anki.",
        "Das Anki-Paket überschreitet das Uploadlimit von 256 MB. Exportiere ein kleineres Paket oder teile die Sammlung in Anki auf.",
      );
    }
    if (cause.status >= 500) {
      return text(
        "The server could not finish the Anki import. No collection was saved. Please try again; if it fails again, report the time and file name.",
        "Der Server konnte den Anki-Import nicht abschließen. Es wurde keine Sammlung gespeichert. Versuche es erneut; falls es wieder fehlschlägt, melde Uhrzeit und Dateinamen.",
      );
    }
  }

  return cause instanceof Error
    ? cause.message
    : text("Import failed.", "Import fehlgeschlagen.");
};
