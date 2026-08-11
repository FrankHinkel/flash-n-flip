"use client";

import {
  ArrowLeft,
  FileArchive,
  FileSpreadsheet,
  FileUp,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
} from "../lib/local-file-import";
import {
  importLocalFilePackage,
  importLocalTextDeck,
} from "../lib/local-product-repository";
import { parseLocalDelimitedCards } from "../lib/local-text-import";
import { formatByteSize } from "@flashcards/domain";
import { enqueueLocalAudioOptimization } from "../lib/audio-optimization";
import { LanguageDirectionFields } from "./language-direction-fields";
import { useI18n } from "./i18n-provider";

type ImportFormat = "CSV" | "APKG" | "FNF";

export function ImportCards() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [format, setFormat] = useState<ImportFormat>("APKG");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceLocale, setSourceLocale] = useState<string>(locale);
  const [targetLocale, setTargetLocale] = useState<string>(
    locale === "de" ? "en" : "de",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const selectFormat = (next: ImportFormat) => {
    setFormat(next);
    setFile(null);
    setContent("");
    setError("");
    setWarnings([]);
    setStatus("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      if (format === "CSV") {
        if (file && file.size > 16 * 1024 * 1024) {
          throw new Error("Die CSV-/TSV-Datei ist größer als 16 MB.");
        }
        const csvContent = file ? await file.text() : content;
        if (!csvContent.trim()) {
          throw new Error("Bitte eine CSV-/TSV-Datei oder Text einfügen.");
        }
        const cards = parseLocalDelimitedCards(csvContent);
        const result = await importLocalTextDeck({
          title: title.trim(),
          sourceLocale,
          targetLocale,
          cards,
        });
        window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
        router.push(`/app/decks/${result.id}`);
        return;
      }
      if (!file) {
        throw new Error(
          text(
            "Please choose an import file.",
            "Bitte eine Importdatei auswählen.",
          ),
        );
      }
      setStatus(
        text(
          "The package is checked and processed locally …",
          "Das Paket wird lokal geprüft und verarbeitet …",
        ),
      );
      const parsed =
        format === "APKG"
          ? await parseLocalAnkiPackage(file)
          : await parseLocalFlashNFlipPackage(file);
      setWarnings(parsed.warnings);
      setStatus(
        text(
          "Cards and original media are being committed atomically …",
          "Karten und Originalmedien werden atomar gespeichert …",
        ),
      );
      const result = await importLocalFilePackage({
        parsed,
        sourceLocale,
        targetLocale,
      });
      sessionStorage.setItem(
        "flash-n-flip:last-local-import",
        JSON.stringify({ ...result, warnings: parsed.warnings }),
      );
      enqueueLocalAudioOptimization(result.audioMediaIds);
      router.push(`/app/decks/${result.deckId}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text("Import failed.", "Import fehlgeschlagen."),
      );
    } finally {
      setBusy(false);
      setStatus("");
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
            {text("Secure local import", "Sicherer lokaler Import")}
          </span>
          <h1>{text("Bring your cards.", "Karten mitbringen.")}</h1>
          <p>
            {text(
              "APKG, FNF, CSV, media, and original audio are processed only on this device and are never uploaded.",
              "APKG, FNF, CSV, Medien und Originalaudio werden ausschließlich auf diesem Gerät verarbeitet und nie hochgeladen.",
            )}
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        <fieldset className="import-format-picker">
          <legend>{text("Import format", "Importformat")}</legend>
          <div>
            {(
              [
                {
                  value: "APKG",
                  icon: FileUp,
                  title: "Anki APKG",
                  description: text(
                    "Classic and current packages",
                    "Klassische und aktuelle Pakete",
                  ),
                },
                {
                  value: "FNF",
                  icon: FileArchive,
                  title: "Flash-n-Flip",
                  description: text(
                    "Portable local .fnf package",
                    "Portables lokales .fnf-Paket",
                  ),
                },
                {
                  value: "CSV",
                  icon: FileSpreadsheet,
                  title: "CSV / TSV",
                  description: text(
                    "Question and answer text",
                    "Frage- und Antworttext",
                  ),
                },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <label key={option.value} className="import-format-option">
                  <input
                    type="radio"
                    name="format"
                    checked={format === option.value}
                    onChange={() => selectFormat(option.value)}
                  />
                  <Icon aria-hidden="true" size={22} />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {format === "CSV" ? (
          <>
            <label>
              {text("Title of the new deck", "Titel des neuen Lernsets")}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label>
              <span>
                <FileSpreadsheet size={18} /> CSV / TSV
              </span>
              <input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError("");
                }}
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={12}
                placeholder={text(
                  "Or paste: question,answer",
                  "Oder einfügen: Frage,Antwort",
                )}
              />
            </label>
          </>
        ) : (
          <label className="file-drop">
            <FileUp size={34} aria-hidden="true" />
            <strong>
              {file?.name ?? text("Choose file", "Datei auswählen")}
            </strong>
            <span>
              {format === "APKG"
                ? text(
                    "Up to 256 MB and 50,000 cards",
                    "Maximal 256 MB und 50.000 Karten",
                  )
                : text(
                    "Local generation-3 FNF package",
                    "Lokales FNF-Paket der Generation 3",
                  )}
            </span>
            <input
              key={format}
              type="file"
              accept={format === "APKG" ? ".apkg" : ".fnf"}
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError("");
                setWarnings([]);
              }}
            />
          </label>
        )}

        <LanguageDirectionFields
          sourceLocale={sourceLocale}
          targetLocale={targetLocale}
          onSourceLocaleChange={setSourceLocale}
          onTargetLocaleChange={setTargetLocale}
          uiLocale={locale}
          disabled={busy}
        />

        <div className="security-info">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>
              {text("Controlled import", "Kontrollierter Import")}
            </strong>
            {text(
              "Scripts, event handlers, external media, unsafe paths, unsupported file signatures, and oversized expanded archives are rejected. Original audio is retained.",
              "Skripte, Event-Handler, externe Medien, unsichere Pfade, nicht unterstützte Dateisignaturen und übergroße entpackte Archive werden abgewiesen. Originalaudio bleibt erhalten.",
            )}
          </span>
        </div>

        {status ? (
          <p role="status" aria-live="polite" className="form-hint">
            {status}
          </p>
        ) : null}
        {warnings.length ? (
          <details className="import-warnings">
            <summary>
              {warnings.length} {text("import notices", "Importhinweise")}
            </summary>
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-primary" disabled={busy}>
          {busy
            ? text("Importing locally …", "Wird lokal importiert …")
            : text("Import locally", "Lokal importieren")}
        </button>
        {format !== "CSV" ? (
          <small className="form-hint">
            {text(
              `The selected file stays on this device. Current selection: ${file ? formatByteSize(file.size, locale) : "—"}.`,
              `Die ausgewählte Datei bleibt auf diesem Gerät. Aktuelle Auswahl: ${file ? formatByteSize(file.size, locale) : "—"}.`,
            )}
          </small>
        ) : null}
      </form>
    </main>
  );
}
