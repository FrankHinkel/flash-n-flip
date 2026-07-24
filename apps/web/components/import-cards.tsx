"use client";

import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../lib/api";

export function ImportCards() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.importCards({
        title: String(data.get("title")),
        format: String(data.get("format")) as "CSV" | "ANKI_TSV",
        content,
      });
      router.push(`/app/decks/${result.deckId}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Import fehlgeschlagen.",
      );
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
            CSV oder ein Anki-Text-Export – ohne Add-ons, Skripte oder aktives
            HTML.
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        <label>
          Titel des neuen Lernsets
          <input name="title" required maxLength={120} />
        </label>
        <label>
          Format
          <select name="format">
            <option value="CSV">CSV (Vorderseite, Rückseite, Tags)</option>
            <option value="ANKI_TSV">
              Anki Text-Export (tabulatorgetrennt)
            </option>
          </select>
        </label>
        <label className="file-drop">
          <FileUp size={34} />
          <strong>{fileName || "Datei auswählen"}</strong>
          <span>Maximal 5 MB und 10.000 Karten</span>
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            required
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) {
                setFileName(file.name);
                setContent(await file.text());
              }
            }}
          />
        </label>
        <div className="security-info">
          <ShieldCheck />
          <span>
            <strong>Kontrollierter Import</strong>Formatierte Inhalte werden in
            sichere Textblöcke umgewandelt. JavaScript, Dateizugriffe und
            Anki-Add-ons werden nicht ausgeführt.
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-primary button-large"
          disabled={!content}
        >
          Import starten
        </button>
      </form>
    </main>
  );
}
