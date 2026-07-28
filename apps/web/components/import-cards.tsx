"use client";

import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import type { AnkiImportResult } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";
import { importErrorMessage } from "./import-error";

export function ImportCards() {
  const router = useRouter();
  const { text } = useI18n();
  const [format, setFormat] = useState<"FNF" | "CSV" | "ANKI_TSV" | "APKG">(
    "FNF",
  );
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnkiImportResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setResult(null);
    setBusy(true);
    try {
      if (format === "FNF") {
        if (!file)
          throw new Error(
            text(
              "Please select a .fnfdeck file.",
              "Bitte eine .fnfdeck-Datei auswählen.",
            ),
          );
        const imported = await api.importFlashNFlipDeck(file, file.name);
        router.push(`/app/decks/${imported.deckId}`);
        return;
      }
      if (format === "APKG") {
        if (!file)
          throw new Error(
            text(
              "Please select an .apkg file.",
              "Bitte eine .apkg-Datei auswählen.",
            ),
          );
        const imported = await api.importAnkiPackage(file, file.name);
        setResult(imported);
        return;
      }
      const result = await api.importCards({
        title: String(data.get("title")),
        format,
        content,
      });
      router.push(`/app/decks/${result.deckId}`);
    } catch (cause) {
      setError(importErrorMessage(cause, format, text));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="app-page import-page">
      <Link className="text-link" href="/app/decks">
        <ArrowLeft size={16} /> {text("Back to library", "Zur Bibliothek")}
      </Link>
      <header className="app-header">
        <div>
          <span className="eyebrow">
            {text("Secure import", "Sicherer Import")}
          </span>
          <h1>{text("Bring your cards.", "Karten mitbringen.")}</h1>
          <p>
            {text(
              "Complete Anki packages with images and audio or simple text files – without add-ons, scripts, or active HTML.",
              "Vollständige Anki-Pakete mit Bildern und Audio oder einfache Textdateien – ohne Add-ons, Skripte oder aktives HTML.",
            )}
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        {format !== "APKG" && format !== "FNF" && (
          <label>
            {text("Title of the new deck", "Titel des neuen Lernsets")}
            <input name="title" required maxLength={120} />
          </label>
        )}
        <label>
          Format
          <select
            name="format"
            value={format}
            onChange={(event) => {
              setFormat(
                event.target.value as "FNF" | "CSV" | "ANKI_TSV" | "APKG",
              );
              setContent("");
              setFile(null);
              setFileName("");
              setResult(null);
              setError("");
            }}
          >
            <option value="FNF">
              {text(
                "Protected Flash-n-Flip deck (.fnfdeck)",
                "Geschütztes Flash-n-Flip-Lernset (.fnfdeck)",
              )}
            </option>
            <option value="APKG">
              {text(
                "Anki package (.apkg, including media)",
                "Anki-Paket (.apkg, inklusive Medien)",
              )}
            </option>
            <option value="CSV">
              {text(
                "CSV (front, back, tags)",
                "CSV (Vorderseite, Rückseite, Tags)",
              )}
            </option>
            <option value="ANKI_TSV">
              {text(
                "Anki text export (tab-separated)",
                "Anki Text-Export (tabulatorgetrennt)",
              )}
            </option>
          </select>
        </label>
        <label className="file-drop">
          <FileUp size={34} />
          <strong>{fileName || text("Choose file", "Datei auswählen")}</strong>
          <span>
            {format === "APKG"
              ? text(
                  "Up to 100 MB and 50,000 cards",
                  "Maximal 100 MB und 50.000 Karten",
                )
              : format === "FNF"
                ? text(
                    "Account-bound, encrypted, signed package",
                    "Kontogebundenes, verschlüsseltes und signiertes Paket",
                  )
                : text(
                    "Up to 5 MB and 10,000 cards",
                    "Maximal 5 MB und 10.000 Karten",
                  )}
          </span>
          <input
            type="file"
            accept={
              format === "FNF"
                ? ".fnfdeck,application/vnd.flash-n-flip.deck,application/octet-stream"
                : format === "APKG"
                  ? ".apkg,application/zip,application/octet-stream"
                  : ".csv,.txt,.tsv,text/csv,text/plain"
            }
            required
            onChange={async (event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setFileName(selected?.name ?? "");
              setError("");
              if (selected && format !== "APKG" && format !== "FNF") {
                setContent(await selected.text());
              }
            }}
          />
        </label>
        <div className="security-info">
          <ShieldCheck />
          <span>
            <strong>
              {text("Controlled import", "Kontrollierter Import")}
            </strong>
            {format === "FNF"
              ? text(
                  "The signature, account binding, checksums, and authenticated encryption are verified before content is stored. Packages from another account are rejected.",
                  "Signatur, Kontobindung, Prüfsummen und authentifizierte Verschlüsselung werden vor dem Speichern geprüft. Pakete eines anderen Kontos werden abgewiesen.",
                )
              : format === "APKG"
                ? text(
                    "Each package becomes one collection with its original deck hierarchy. Templates are read as data only. Scripts, CSS, external files, and Anki add-ons are not executed. Anki review history is not imported; every card starts fresh.",
                    "Jedes Paket wird als eine Sammlung mit seiner ursprünglichen Lernset-Hierarchie importiert. Vorlagen werden nur als Daten gelesen. Skripte, CSS, externe Dateien und Anki-Add-ons werden nicht ausgeführt. Der Anki-Lernverlauf wird nicht übernommen; alle Karten starten neu.",
                  )
                : text(
                    "Formatted content is converted into safe text blocks. JavaScript, file access, and Anki add-ons are not executed.",
                    "Formatierte Inhalte werden in sichere Textblöcke umgewandelt. JavaScript, Dateizugriffe und Anki-Add-ons werden nicht ausgeführt.",
                  )}
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <section className="import-result" aria-live="polite">
            <strong>{text("Import complete", "Import abgeschlossen")}</strong>
            <p>
              {text("Collection", "Sammlung")}{" "}
              <strong>{result.collectionTitle}</strong>: {result.importedCards}{" "}
              {result.importedCards === 1
                ? text("card", "Karte")
                : text("cards", "Karten")}{" "}
              {text("in", "in")} {result.importedDecks}{" "}
              {result.importedDecks === 1
                ? text("deck", "Lernset")
                : text("decks", "Lernsets")}{" "}
              {text("with", "mit")} {result.importedMedia}{" "}
              {text("media files.", "Mediendateien.")}
            </p>
            {result.warnings.length > 0 && (
              <details>
                <summary>
                  {result.warnings.length}{" "}
                  {result.warnings.length === 1
                    ? text("import note", "Importhinweis")
                    : text("import notes", "Importhinweise")}
                </summary>
                <ul>
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
            <Link className="button button-primary" href="/app/decks">
              {text("Open collection", "Sammlung öffnen")}
            </Link>
          </section>
        )}
        <button
          className="button button-primary button-large"
          disabled={
            busy || (format === "APKG" || format === "FNF" ? !file : !content)
          }
        >
          {busy
            ? text("Importing …", "Import läuft …")
            : text("Start import", "Import starten")}
        </button>
      </form>
    </main>
  );
}
