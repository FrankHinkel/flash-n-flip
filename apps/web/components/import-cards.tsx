"use client";

import { ArrowLeft, FileSpreadsheet, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { importLocalTextDeck } from "../lib/local-product-repository";
import { LanguageDirectionFields } from "./language-direction-fields";
import { useI18n } from "./i18n-provider";

const parseDelimitedLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!;
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted)
    throw new Error(
      "Eine Textzeile enthält ein nicht geschlossenes Anführungszeichen.",
    );
  values.push(value.trim());
  return values;
};

export function ImportCards() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceLocale, setSourceLocale] = useState<string>(locale);
  const [targetLocale, setTargetLocale] = useState<string>(
    locale === "de" ? "en" : "de",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const lines = content
        .replaceAll("\r\n", "\n")
        .split("\n")
        .filter((line) => line.trim());
      const delimiter = lines.some((line) => line.includes("\t")) ? "\t" : ",";
      const cards = lines.map((line, index) => {
        const fields = parseDelimitedLine(line, delimiter);
        if (fields.length < 2 || !fields[0] || !fields[1]) {
          throw new Error(
            `Zeile ${String(index + 1)} benötigt Vorder- und Rückseite.`,
          );
        }
        return { front: fields[0], back: fields.slice(1).join(delimiter) };
      });
      const result = await importLocalTextDeck({
        title: title.trim(),
        sourceLocale,
        targetLocale,
        cards,
      });
      window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
      router.push(`/app/decks/${result.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : text("Import failed.", "Import fehlgeschlagen."),
      );
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
            {text("Local import", "Lokaler Import")}
          </span>
          <h1>{text("Bring your cards.", "Karten mitbringen.")}</h1>
          <p>
            {text(
              "The file is processed only on this device and is never uploaded.",
              "Die Datei wird ausschließlich auf diesem Gerät verarbeitet und nie hochgeladen.",
            )}
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        <label>
          {text("Title of the new deck", "Titel des neuen Lernsets")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={120}
          />
        </label>
        <LanguageDirectionFields
          sourceLocale={sourceLocale}
          targetLocale={targetLocale}
          onSourceLocaleChange={setSourceLocale}
          onTargetLocaleChange={setTargetLocale}
          uiLocale={locale}
        />
        <label>
          <span>
            <FileSpreadsheet size={18} /> CSV / TSV
          </span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            rows={12}
            placeholder={text("question,answer", "Frage,Antwort")}
          />
        </label>
        <p className="form-hint">
          <ShieldCheck size={16} />{" "}
          {text(
            "APKG, media, and audio optimization will follow as native background imports. Until then, original media is preserved through complete local backups.",
            "APKG, Medien und Audio-Optimierung folgen als native Hintergrundimporte. Bis dahin bleiben Originalmedien über vollständige lokale Sicherungen erhalten.",
          )}
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-primary" disabled={busy}>
          {busy
            ? text("Importing …", "Importiert …")
            : text("Import locally", "Lokal importieren")}
        </button>
      </form>
    </main>
  );
}
