"use client";

import { ArrowLeft, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import type {
  AnkiFieldRole,
  AnkiImportProgress,
  AnkiImportPreview,
  AnkiImportResult,
} from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";
import { importErrorMessage } from "./import-error";
import { LanguageDirectionFields } from "./language-direction-fields";
import { fileSha256 } from "../lib/file-sha256";

const maximumApkgBytes = 256 * 1024 * 1024;

export function ImportCards() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [format, setFormat] = useState<"FNF" | "CSV" | "ANKI_TSV" | "APKG">(
    "FNF",
  );
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AnkiImportProgress | null>(null);
  const [result, setResult] = useState<AnkiImportResult | null>(null);
  const [preview, setPreview] = useState<AnkiImportPreview | null>(null);
  const [mappings, setMappings] = useState<
    Record<string, Record<string, AnkiFieldRole>>
  >({});
  const [includedMedia, setIncludedMedia] = useState<string[]>([]);
  const [coverSourceName, setCoverSourceName] = useState("");
  const [sourceLocale, setSourceLocale] = useState<string>(locale);
  const [targetLocale, setTargetLocale] = useState<string>(locale);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setResult(null);
    setProgress(null);
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
        if (file.size > maximumApkgBytes)
          throw new Error(
            text(
              "The Anki package exceeds 256 MB. Export a smaller package or split the collection in Anki.",
              "Das Anki-Paket überschreitet 256 MB. Exportiere ein kleineres Paket oder teile die Sammlung in Anki auf.",
            ),
          );
        if (!preview) {
          setProgress({ phase: "hashing", percent: 0 });
          const sha256 = await fileSha256(file, (percent) =>
            setProgress({ phase: "hashing", percent }),
          );
          setProgress({ phase: "processing" });
          const cache = await api.checkAnkiPackageCache(sha256);
          const analyzed = cache.cached
            ? await api.previewCachedAnkiPackage(sha256, file.name)
            : await api.uploadAnkiPackagePreview(
                file,
                file.name,
                sha256,
                setProgress,
              );
          setPreview(analyzed);
          setMappings(
            Object.fromEntries(
              analyzed.noteTypes.map((noteType) => [
                noteType.sourceNoteTypeId,
                Object.fromEntries(
                  noteType.fields.map((field) => [
                    field.name,
                    field.suggestedRole,
                  ]),
                ),
              ]),
            ),
          );
          setIncludedMedia(
            analyzed.mediaGroups
              .filter((group) => group.defaultIncluded)
              .map((group) => group.id),
          );
          setCoverSourceName("");
          setProgress(null);
          return;
        }
        for (const noteType of preview.noteTypes) {
          if (noteType.isCloze || /image occlusion/i.test(noteType.name))
            continue;
          const roles = Object.values(
            mappings[noteType.sourceNoteTypeId] ?? {},
          );
          if (
            roles.filter((role) => role === "PRIMARY_A").length !== 1 ||
            roles.filter((role) => role === "PRIMARY_B").length !== 1
          ) {
            throw new Error(
              text(
                `Assign exactly one main side A and one main side B for “${noteType.name}”.`,
                `Ordne für „${noteType.name}“ genau eine Hauptseite A und eine Hauptseite B zu.`,
              ),
            );
          }
        }
        setProgress({ phase: "processing" });
        const imported = await api.commitAnkiPackage({
          sha256: preview.sha256,
          fileName: preview.fileName,
          sourceLocale,
          targetLocale,
          mappings,
          includedMediaGroupIds: includedMedia,
          coverSourceName: coverSourceName || undefined,
        });
        setResult(imported);
        setPreview(null);
        setProgress(null);
        return;
      }
      const result = await api.importCards({
        title: String(data.get("title")),
        format,
        content,
        sourceLocale,
        targetLocale,
      });
      router.push(`/app/decks/${result.deckId}`);
    } catch (cause) {
      setProgress(null);
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
              setPreview(null);
              setMappings({});
              setIncludedMedia([]);
              setCoverSourceName("");
              setProgress(null);
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
        {format !== "FNF" && (
          <>
            <LanguageDirectionFields
              sourceLocale={sourceLocale}
              targetLocale={targetLocale}
              onSourceLocaleChange={(nextLocale) => {
                const targetFollowedSource = targetLocale === sourceLocale;
                setSourceLocale(nextLocale);
                if (targetFollowedSource) setTargetLocale(nextLocale);
              }}
              onTargetLocaleChange={setTargetLocale}
              uiLocale={locale}
              disabled={busy}
            />
            {format === "APKG" && (
              <p className="import-language-note">
                {text(
                  "Anki packages do not contain a reliable standardized source and target language. Confirm the initial language pair. For recognized Xefjord Complete cards, Flash-n-Flip detects each card's direction and removes the standalone language marker; other packages keep the selected default direction.",
                  "Anki-Pakete enthalten keine verlässliche standardisierte Quell- und Zielsprache. Bitte bestätige das anfängliche Sprachpaar. Bei erkannten Xefjord-Complete-Karten bestimmt Flash-n-Flip die Richtung je Karte und entfernt den alleinstehenden Sprachmarker; andere Pakete behalten die gewählte Standardrichtung.",
                )}
              </p>
            )}
          </>
        )}
        <label className="file-drop">
          <FileUp size={34} />
          <strong>{fileName || text("Choose file", "Datei auswählen")}</strong>
          <span>
            {format === "APKG"
              ? text(
                  "Up to 256 MB and 50,000 cards",
                  "Maximal 256 MB und 50.000 Karten",
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
              setPreview(null);
              setMappings({});
              setIncludedMedia([]);
              setCoverSourceName("");
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
        {busy && format === "APKG" && progress && (
          <section
            className="import-progress"
            aria-label={text("Import progress", "Importfortschritt")}
          >
            <div>
              <strong role="status" aria-live="polite">
                {progress.phase === "hashing"
                  ? text("Checking file locally", "Datei wird lokal geprüft")
                  : progress.phase === "uploading"
                    ? text(
                        "Uploading Anki package",
                        "Anki-Paket wird hochgeladen",
                      )
                    : text(
                        "Processing cards and media",
                        "Karten und Medien werden verarbeitet",
                      )}
              </strong>
              {progress.phase !== "processing" && progress.percent !== null && (
                <span aria-hidden="true">{progress.percent}%</span>
              )}
            </div>
            <progress
              max={100}
              value={
                progress.phase !== "processing" && progress.percent !== null
                  ? progress.percent
                  : undefined
              }
              aria-label={
                progress.phase === "hashing"
                  ? text("Local file check", "Lokale Dateiprüfung")
                  : progress.phase === "uploading"
                    ? text("Package upload", "Paket-Upload")
                    : text("Package processing", "Paketverarbeitung")
              }
            />
            <p>
              {progress.phase === "hashing"
                ? text(
                    "The checksum is calculated in chunks. If this exact file is already in your private cache, no upload is needed.",
                    "Die Prüfsumme wird abschnittsweise berechnet. Liegt genau diese Datei bereits in deinem privaten Cache, entfällt der Upload.",
                  )
                : progress.phase === "uploading"
                  ? text(
                      "The upload percentage shows the transferred package data.",
                      "Die Prozentanzeige zeigt die übertragenen Paketdaten.",
                    )
                  : text(
                      "The package has arrived. Large collections can take several minutes to process safely.",
                      "Das Paket ist angekommen. Die sichere Verarbeitung großer Sammlungen kann mehrere Minuten dauern.",
                    )}
            </p>
          </section>
        )}
        {preview && !result && (
          <section
            className="anki-import-preview"
            aria-labelledby="anki-preview-title"
          >
            <div className="anki-preview-summary">
              <div>
                <span className="eyebrow">{text("Analysis", "Analyse")}</span>
                <h2 id="anki-preview-title">{preview.collectionTitle}</h2>
              </div>
              <p>
                {preview.noteCount.toLocaleString(locale)}{" "}
                {text("notes", "Notizen")} ·{" "}
                {preview.cardCount.toLocaleString(locale)}{" "}
                {text("cards", "Karten")} ·{" "}
                {preview.deckCount.toLocaleString(locale)}{" "}
                {text("decks", "Lernsets")}
              </p>
              <p className="cache-result" role="status">
                {preview.cached
                  ? text(
                      "Private cache hit – upload skipped.",
                      "Privater Cache-Treffer – Upload übersprungen.",
                    )
                  : text(
                      "Package uploaded once and stored in your private import cache.",
                      "Paket einmal hochgeladen und in deinem privaten Import-Cache gespeichert.",
                    )}
              </p>
            </div>
            {preview.noteTypes.map((noteType) => (
              <fieldset
                className="anki-note-mapping"
                key={noteType.sourceNoteTypeId}
              >
                <legend>
                  {text("Note type", "Notiztyp")}: {noteType.name} (
                  {noteType.cardCount.toLocaleString(locale)})
                </legend>
                <p>
                  {text(
                    "Assign every variable Anki field to a safe Flash-n-Flip role. Metadata is preserved but no longer mixed into the visible answer.",
                    "Ordne jedes variable Anki-Feld einer sicheren Flash-n-Flip-Rolle zu. Metadaten bleiben erhalten, werden aber nicht mehr in die sichtbare Antwort gemischt.",
                  )}
                </p>
                <div className="anki-field-list">
                  {noteType.fields.map((field) => (
                    <label className="anki-field-row" key={field.name}>
                      <span>
                        <strong>{field.name}</strong>
                        <small>
                          {field.sample ||
                            (field.mediaCount
                              ? `${field.mediaCount} ${text("media files", "Medien")}`
                              : text("Empty in sample", "Im Beispiel leer"))}
                        </small>
                      </span>
                      <select
                        value={
                          mappings[noteType.sourceNoteTypeId]?.[field.name] ??
                          field.suggestedRole
                        }
                        onChange={(event) =>
                          setMappings((current) => ({
                            ...current,
                            [noteType.sourceNoteTypeId]: {
                              ...current[noteType.sourceNoteTypeId],
                              [field.name]: event.target.value as AnkiFieldRole,
                            },
                          }))
                        }
                        aria-label={`${field.name}: ${text("field role", "Feldrolle")}`}
                      >
                        <option value="PRIMARY_A">
                          {text("Main side A", "Hauptseite A")}
                        </option>
                        <option value="PRIMARY_B">
                          {text("Main side B", "Hauptseite B")}
                        </option>
                        <option value="MEDIA_A">
                          {text("Media side A", "Medien Seite A")}
                        </option>
                        <option value="MEDIA_B">
                          {text("Media side B", "Medien Seite B")}
                        </option>
                        <option value="HINT">
                          {text("Hint / explanation", "Hinweis / Erklärung")}
                        </option>
                        <option value="HINT_MEDIA">
                          {text("Hint media", "Hinweis-Medien")}
                        </option>
                        <option value="CATEGORY">
                          {text("Category / tag", "Kategorie / Tag")}
                        </option>
                        <option value="ORDER">
                          {text("Order / ranking", "Reihenfolge / Rang")}
                        </option>
                        <option value="SOURCE_ID">
                          {text("Source ID", "Quell-ID")}
                        </option>
                        <option value="IGNORE">
                          {text("Preserve only", "Nur erhalten")}
                        </option>
                      </select>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <fieldset className="anki-media-selection">
              <legend>{text("Select media", "Medien auswählen")}</legend>
              <p>
                {text(
                  "Deselected media is neither stored nor synchronized. Scripts and styles are always excluded.",
                  "Abgewählte Medien werden weder gespeichert noch synchronisiert. Skripte und Stylesheets sind immer ausgeschlossen.",
                )}
              </p>
              {preview.mediaGroups.map((group) => (
                <label key={group.id}>
                  <input
                    type="checkbox"
                    checked={includedMedia.includes(group.id)}
                    onChange={(event) =>
                      setIncludedMedia((current) =>
                        event.target.checked
                          ? [...new Set([...current, group.id])]
                          : current.filter((id) => id !== group.id),
                      )
                    }
                  />
                  <span>
                    <strong>
                      {group.fieldName} ·{" "}
                      {group.kind === "image"
                        ? text("Images", "Bilder")
                        : "Audio"}
                    </strong>
                    <small>
                      {group.fileCount.toLocaleString(locale)}{" "}
                      {text("files", "Dateien")} ·{" "}
                      {(group.byteSize / 1024 / 1024).toLocaleString(locale, {
                        maximumFractionDigits: 1,
                      })}{" "}
                      MB
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>
            {preview.coverCandidates.length > 0 && (
              <label className="anki-cover-select">
                {text("Collection image", "Collection-Bild")}
                <select
                  value={coverSourceName}
                  onChange={(event) => setCoverSourceName(event.target.value)}
                >
                  <option value="">
                    {text(
                      "Do not use a package image",
                      "Kein Paketbild verwenden",
                    )}
                  </option>
                  {preview.coverCandidates.map((candidate) => (
                    <option
                      key={candidate.sourceName}
                      value={candidate.sourceName}
                    >
                      {candidate.sourceName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>
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
            {result.detectedLanguageCards > 0 && (
              <p>
                {text(
                  `${result.detectedLanguageCards} Xefjord cards received an individual language direction; ${result.removedLanguageMarkers} standalone language markers were removed.`,
                  `${result.detectedLanguageCards} Xefjord-Karten haben eine individuelle Sprachrichtung erhalten; ${result.removedLanguageMarkers} alleinstehende Sprachmarker wurden entfernt.`,
                )}
              </p>
            )}
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
            <Link
              className="button button-primary"
              href={`/app/decks/${result.collectionDeckId}`}
            >
              {text(
                "Review languages and open collection",
                "Sprachen prüfen und Collection öffnen",
              )}
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
            ? progress &&
              progress.phase !== "processing" &&
              progress.percent !== null
              ? text(
                  `Uploading ${progress.percent}%`,
                  `Upload ${progress.percent}%`,
                )
              : text("Importing …", "Import läuft …")
            : format === "APKG" && !preview
              ? text("Analyze package", "Paket analysieren")
              : format === "APKG"
                ? text(
                    "Import with this selection",
                    "Mit dieser Auswahl importieren",
                  )
                : text("Start import", "Import starten")}
        </button>
      </form>
    </main>
  );
}
