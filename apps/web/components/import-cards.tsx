"use client";

import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import type { AnkiImportResult } from "@flashcards/api-client";

import { api } from "../lib/api";

export function ImportCards() {
  const router = useRouter();
  const [format, setFormat] = useState<"CSV" | "ANKI_TSV" | "APKG">("APKG");
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
      if (format === "APKG") {
        if (!file) throw new Error("Bitte eine .apkg-Datei auswählen.");
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
      setError(
        cause instanceof Error ? cause.message : "Import fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="app-page import-page">
      <Link className="text-link" href="/app/decks">
        <ArrowLeft size={16} /> Zur Bibliothek
      </Link>
      <header className="app-header">
        <div>
          <span className="eyebrow">Sicherer Import</span>
          <h1>Karten mitbringen.</h1>
          <p>
            Vollständige Anki-Pakete mit Bildern und Audio oder einfache
            Textdateien – ohne Add-ons, Skripte oder aktives HTML.
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        {format !== "APKG" && (
          <label>
            Titel des neuen Lernsets
            <input name="title" required maxLength={120} />
          </label>
        )}
        <label>
          Format
          <select
            name="format"
            value={format}
            onChange={(event) => {
              setFormat(event.target.value as "CSV" | "ANKI_TSV" | "APKG");
              setContent("");
              setFile(null);
              setFileName("");
              setResult(null);
              setError("");
            }}
          >
            <option value="APKG">Anki-Paket (.apkg, inklusive Medien)</option>
            <option value="CSV">CSV (Vorderseite, Rückseite, Tags)</option>
            <option value="ANKI_TSV">
              Anki Text-Export (tabulatorgetrennt)
            </option>
          </select>
        </label>
        <label className="file-drop">
          <FileUp size={34} />
          <strong>{fileName || "Datei auswählen"}</strong>
          <span>
            {format === "APKG"
              ? "Maximal 100 MB und 50.000 Karten"
              : "Maximal 5 MB und 10.000 Karten"}
          </span>
          <input
            type="file"
            accept={
              format === "APKG"
                ? ".apkg,application/zip,application/octet-stream"
                : ".csv,.txt,.tsv,text/csv,text/plain"
            }
            required
            onChange={async (event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setFileName(selected?.name ?? "");
              setError("");
              if (selected && format !== "APKG") {
                setContent(await selected.text());
              }
            }}
          />
        </label>
        <div className="security-info">
          <ShieldCheck />
          <span>
            <strong>Kontrollierter Import</strong>
            {format === "APKG"
              ? "Vorlagen werden nur als Daten gelesen. Skripte, CSS, externe Dateien und Anki-Add-ons werden nicht ausgeführt. Der Anki-Lernverlauf wird nicht übernommen; alle Karten starten neu."
              : "Formatierte Inhalte werden in sichere Textblöcke umgewandelt. JavaScript, Dateizugriffe und Anki-Add-ons werden nicht ausgeführt."}
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <section className="import-result" aria-live="polite">
            <strong>Import abgeschlossen</strong>
            <p>
              {result.importedCards}{" "}
              {result.importedCards === 1 ? "Karte" : "Karten"} in{" "}
              {result.importedDecks} Lernset
              {result.importedDecks === 1 ? "" : "s"} mit {result.importedMedia}{" "}
              Mediendateien.
            </p>
            {result.warnings.length > 0 && (
              <details>
                <summary>
                  {result.warnings.length} Importhinweis
                  {result.warnings.length === 1 ? "" : "e"}
                </summary>
                <ul>
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
            <Link
              className="button button-primary"
              href={`/app/decks/${result.primaryDeckId}`}
            >
              Erstes Lernset öffnen
            </Link>
          </section>
        )}
        <button
          className="button button-primary button-large"
          disabled={busy || (format === "APKG" ? !file : !content)}
        >
          {busy ? "Import läuft …" : "Import starten"}
        </button>
      </form>
    </main>
  );
}
