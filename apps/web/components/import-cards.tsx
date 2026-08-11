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
import {
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

import {
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
  type LocalFileImport,
} from "../lib/local-file-import";
import type {
  AnkiFieldRole,
  AnkiImportPreview,
} from "@flashcards/domain/anki-import-plan";
import {
  xefjordAnkiProfileId,
  type AnkiImportProfileSelection,
} from "@flashcards/domain/anki-import-profile";
import {
  importLocalFilePackage,
  importLocalTextDeck,
} from "../lib/local-product-repository";
import { parseLocalDelimitedCards } from "../lib/local-text-import";
import { formatByteSize } from "@flashcards/domain";
import { enqueueLocalAudioOptimization } from "../lib/audio-optimization";
import { LanguageDirectionFields } from "./language-direction-fields";
import { AnkiImportProfileEditor } from "./anki-import-profile-editor";
import { hasPreservedAnkiLayout } from "./anki-field-mapping";
import { useI18n } from "./i18n-provider";

type ImportFormat = "CSV" | "APKG" | "FNF";

const fieldRoleOptions: Array<{
  value: AnkiFieldRole;
  english: string;
  german: string;
}> = [
  { value: "PRIMARY_A", english: "Main side A", german: "Hauptseite A" },
  { value: "PRIMARY_B", english: "Main side B", german: "Hauptseite B" },
  { value: "MEDIA_A", english: "Media side A", german: "Medien Seite A" },
  { value: "MEDIA_B", english: "Media side B", german: "Medien Seite B" },
  { value: "HINT", english: "Hint", german: "Hinweis" },
  { value: "HINT_MEDIA", english: "Hint media", german: "Hinweismedium" },
  { value: "CATEGORY", english: "Category", german: "Kategorie" },
  { value: "ORDER", english: "Order", german: "Reihenfolge" },
  { value: "SOURCE_ID", english: "Source ID", german: "Quell-ID" },
  { value: "IGNORE", english: "Ignore", german: "Ignorieren" },
];

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
  const [previewBusy, setPreviewBusy] = useState(false);
  const [prepared, setPrepared] = useState<{
    file: File;
    parsed: LocalFileImport;
    sourceLocale: string;
    targetLocale: string;
  } | null>(null);
  const previewRequest = useRef(0);
  const [status, setStatus] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mappings, setMappings] = useState<
    Record<string, Record<string, AnkiFieldRole>>
  >({});
  const [includedSourceDeckIds, setIncludedSourceDeckIds] = useState<string[]>(
    [],
  );
  const [subdeckFields, setSubdeckFields] = useState<Record<string, string[]>>(
    {},
  );
  const [profileSelection, setProfileSelection] = useState<
    AnkiImportProfileSelection | undefined
  >();
  const [includedMediaGroupIds, setIncludedMediaGroupIds] = useState<string[]>(
    [],
  );
  const [coverSourceName, setCoverSourceName] = useState("");

  const selectFormat = (next: ImportFormat) => {
    previewRequest.current += 1;
    setFormat(next);
    setFile(null);
    setContent("");
    setError("");
    setWarnings([]);
    setStatus("");
    setPrepared(null);
    setPreviewBusy(false);
    setMappings({});
    setIncludedSourceDeckIds([]);
    setSubdeckFields({});
    setProfileSelection(undefined);
    setIncludedMediaGroupIds([]);
    setCoverSourceName("");
  };

  const preparePreview = async (
    selectedFile: File,
    selectedFormat: Exclude<ImportFormat, "CSV">,
  ) => {
    const request = ++previewRequest.current;
    setPreviewBusy(true);
    setPrepared(null);
    setError("");
    setWarnings([]);
    setStatus(
      text(
        "The package is being checked locally …",
        "Das Paket wird lokal geprüft …",
      ),
    );
    try {
      const parsed =
        selectedFormat === "APKG"
          ? await parseLocalAnkiPackage(selectedFile, {
              sourceLocale,
              targetLocale,
            })
          : await parseLocalFlashNFlipPackage(selectedFile);
      if (request !== previewRequest.current) return;
      const resolvedSource = parsed.suggestedSourceLocale ?? sourceLocale;
      const resolvedTarget = parsed.suggestedTargetLocale ?? targetLocale;
      setSourceLocale(resolvedSource);
      setTargetLocale(resolvedTarget);
      setPrepared({
        file: selectedFile,
        parsed,
        sourceLocale: resolvedSource,
        targetLocale: resolvedTarget,
      });
      if (parsed.ankiPreview) {
        setMappings(
          Object.fromEntries(
            parsed.ankiPreview.noteTypes.map((noteType) => [
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
        setIncludedSourceDeckIds(
          parsed.ankiPreview.sourceHierarchy.decks.map(
            (deck) => deck.sourceDeckId,
          ),
        );
        setSubdeckFields({});
        setIncludedMediaGroupIds(
          parsed.ankiPreview.mediaGroups
            .filter((group) => group.defaultIncluded)
            .map((group) => group.id),
        );
        setCoverSourceName("");
        setProfileSelection(
          parsed.ankiPreview.xefjordPreset.detected
            ? { kind: "BUILT_IN", profileId: xefjordAnkiProfileId }
            : undefined,
        );
      }
      setWarnings(parsed.warnings);
    } catch (cause) {
      if (request !== previewRequest.current) return;
      setError(
        cause instanceof Error
          ? cause.message
          : text("Package check failed.", "Paketprüfung fehlgeschlagen."),
      );
    } finally {
      if (request === previewRequest.current) {
        setPreviewBusy(false);
        setStatus("");
      }
    }
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
      if (format === "APKG" && includedSourceDeckIds.length === 0) {
        throw new Error(
          text(
            "Select at least one Anki deck.",
            "Wähle mindestens einen Anki-Stapel aus.",
          ),
        );
      }
      const parsed =
        prepared?.file === file && format === "FNF"
          ? prepared.parsed
          : format === "APKG"
            ? await parseLocalAnkiPackage(
                file,
                {
                  sourceLocale,
                  targetLocale,
                },
                {
                  includedSourceDeckIds,
                  mappings,
                  subdeckFields,
                  profileSelection,
                  includedMediaGroupIds,
                  coverSourceName: coverSourceName || undefined,
                },
              )
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
                const selectedFile = event.target.files?.[0] ?? null;
                setFile(selectedFile);
                setError("");
                setWarnings([]);
                setPrepared(null);
                setMappings({});
                setIncludedSourceDeckIds([]);
                setSubdeckFields({});
                setProfileSelection(undefined);
                setIncludedMediaGroupIds([]);
                setCoverSourceName("");
                if (selectedFile) {
                  void preparePreview(selectedFile, format);
                }
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
          disabled={busy || previewBusy}
        />

        {prepared ? (
          <section
            className="security-info"
            aria-labelledby="import-preview-title"
          >
            <FileArchive aria-hidden="true" />
            <span>
              <strong id="import-preview-title">
                {text("Checked package", "Geprüftes Paket")}:{" "}
                {prepared.parsed.title}
              </strong>
              {text(
                `${prepared.parsed.decks.length.toLocaleString("en")} decks, ${prepared.parsed.decks.reduce((count, deck) => count + deck.cards.length, 0).toLocaleString("en")} cards and ${prepared.parsed.media.length.toLocaleString("en")} media files. Direction: ${prepared.sourceLocale} → ${prepared.targetLocale}.`,
                `${prepared.parsed.decks.length.toLocaleString("de-DE")} Lernsets, ${prepared.parsed.decks.reduce((count, deck) => count + deck.cards.length, 0).toLocaleString("de-DE")} Karten und ${prepared.parsed.media.length.toLocaleString("de-DE")} Mediendateien. Richtung: ${prepared.sourceLocale} → ${prepared.targetLocale}.`,
              )}
            </span>
          </section>
        ) : null}

        {prepared?.parsed.ankiPreview && format === "APKG" ? (
          <AnkiImportOptions
            preview={prepared.parsed.ankiPreview}
            mappings={mappings}
            onMappingsChange={setMappings}
            includedSourceDeckIds={includedSourceDeckIds}
            onIncludedSourceDeckIdsChange={setIncludedSourceDeckIds}
            subdeckFields={subdeckFields}
            onSubdeckFieldsChange={setSubdeckFields}
            profileSelection={profileSelection}
            onProfileSelectionChange={setProfileSelection}
            includedMediaGroupIds={includedMediaGroupIds}
            onIncludedMediaGroupIdsChange={setIncludedMediaGroupIds}
            coverSourceName={coverSourceName}
            onCoverSourceNameChange={setCoverSourceName}
            locale={locale}
            text={text}
          />
        ) : null}

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
        <button
          className="button button-primary"
          disabled={busy || previewBusy || (format !== "CSV" && !prepared)}
        >
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

function AnkiImportOptions({
  preview,
  mappings,
  onMappingsChange,
  includedSourceDeckIds,
  onIncludedSourceDeckIdsChange,
  subdeckFields,
  onSubdeckFieldsChange,
  profileSelection,
  onProfileSelectionChange,
  includedMediaGroupIds,
  onIncludedMediaGroupIdsChange,
  coverSourceName,
  onCoverSourceNameChange,
  locale,
  text,
}: {
  preview: AnkiImportPreview;
  mappings: Record<string, Record<string, AnkiFieldRole>>;
  onMappingsChange: Dispatch<
    SetStateAction<Record<string, Record<string, AnkiFieldRole>>>
  >;
  includedSourceDeckIds: string[];
  onIncludedSourceDeckIdsChange: Dispatch<SetStateAction<string[]>>;
  subdeckFields: Record<string, string[]>;
  onSubdeckFieldsChange: Dispatch<SetStateAction<Record<string, string[]>>>;
  profileSelection?: AnkiImportProfileSelection;
  onProfileSelectionChange: Dispatch<
    SetStateAction<AnkiImportProfileSelection | undefined>
  >;
  includedMediaGroupIds: string[];
  onIncludedMediaGroupIdsChange: Dispatch<SetStateAction<string[]>>;
  coverSourceName: string;
  onCoverSourceNameChange: Dispatch<SetStateAction<string>>;
  locale: string;
  text: (english: string, german: string) => string;
}) {
  return (
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
          {preview.noteCount.toLocaleString(locale)} {text("notes", "Notizen")}{" "}
          · {preview.cardCount.toLocaleString(locale)} {text("cards", "Karten")}{" "}
          · {preview.deckCount.toLocaleString(locale)}{" "}
          {text("decks", "Lernsets")}
        </p>
      </div>

      <AnkiImportProfileEditor
        preview={preview}
        mappings={mappings}
        selection={profileSelection}
        onSelectionChange={onProfileSelectionChange}
        text={text}
      />

      <fieldset className="anki-source-deck-selection">
        <legend>{text("Select Anki decks", "Anki-Stapel auswählen")}</legend>
        <div className="anki-source-deck-actions">
          <span aria-live="polite">
            {includedSourceDeckIds.length.toLocaleString(locale)} /{" "}
            {preview.sourceHierarchy.decks.length.toLocaleString(locale)}{" "}
            {text("selected", "ausgewählt")}
          </span>
          <button
            type="button"
            onClick={() =>
              onIncludedSourceDeckIdsChange(
                preview.sourceHierarchy.decks.map((deck) => deck.sourceDeckId),
              )
            }
          >
            {text("Select all", "Alle auswählen")}
          </button>
          <button
            type="button"
            onClick={() => onIncludedSourceDeckIdsChange([])}
          >
            {text("Select none", "Keine auswählen")}
          </button>
        </div>
        <div className="anki-source-deck-list">
          {preview.sourceHierarchy.decks.map((deck) => (
            <label key={deck.sourceDeckId}>
              <input
                type="checkbox"
                checked={includedSourceDeckIds.includes(deck.sourceDeckId)}
                onChange={(event) =>
                  onIncludedSourceDeckIdsChange((current) =>
                    event.target.checked
                      ? [...current, deck.sourceDeckId]
                      : current.filter((id) => id !== deck.sourceDeckId),
                  )
                }
              />
              <span>
                <strong>{deck.path.join(" › ")}</strong>
                <small>
                  {deck.cardCount.toLocaleString(locale)}{" "}
                  {text("cards", "Karten")}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {preview.noteTypes.map((noteType) => (
        <fieldset className="anki-note-mapping" key={noteType.sourceNoteTypeId}>
          <legend>
            {text("Note type", "Notiztyp")}: {noteType.name} (
            {noteType.cardCount.toLocaleString(locale)})
          </legend>
          {noteType.fields.map((field) => {
            const selectedSubdecks =
              subdeckFields[noteType.sourceNoteTypeId] ?? [];
            return (
              <div className="anki-field-row" key={field.name}>
                <span>
                  <strong>{field.name}</strong>
                  {field.sample ? <small>{field.sample}</small> : null}
                </span>
                {!hasPreservedAnkiLayout(noteType) &&
                profileSelection?.kind !== "CUSTOM" ? (
                  <label>
                    <span className="visually-hidden">
                      {text(
                        `Role for ${field.name}`,
                        `Rolle für ${field.name}`,
                      )}
                    </span>
                    <select
                      value={
                        mappings[noteType.sourceNoteTypeId]?.[field.name] ??
                        field.suggestedRole
                      }
                      onChange={(event) =>
                        onMappingsChange((current) => ({
                          ...current,
                          [noteType.sourceNoteTypeId]: {
                            ...current[noteType.sourceNoteTypeId],
                            [field.name]: event.target.value as AnkiFieldRole,
                          },
                        }))
                      }
                    >
                      {fieldRoleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {text(option.english, option.german)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  <input
                    type="checkbox"
                    checked={selectedSubdecks.includes(field.name)}
                    onChange={(event) =>
                      onSubdeckFieldsChange((current) => ({
                        ...current,
                        [noteType.sourceNoteTypeId]: event.target.checked
                          ? [...selectedSubdecks, field.name]
                          : selectedSubdecks.filter(
                              (name) => name !== field.name,
                            ),
                      }))
                    }
                  />
                  {text("Create subdeck", "Unterdeck erzeugen")}
                </label>
              </div>
            );
          })}
        </fieldset>
      ))}

      {preview.mediaGroups.length ? (
        <fieldset className="anki-media-selection">
          <legend>{text("Media", "Medien")}</legend>
          {preview.mediaGroups.map((group) => (
            <label key={group.id}>
              <input
                type="checkbox"
                checked={includedMediaGroupIds.includes(group.id)}
                onChange={(event) =>
                  onIncludedMediaGroupIdsChange((current) =>
                    event.target.checked
                      ? [...current, group.id]
                      : current.filter((id) => id !== group.id),
                  )
                }
              />
              <span>
                <strong>{group.fieldName}</strong>
                <small>
                  {group.fileCount.toLocaleString(locale)}{" "}
                  {text("files", "Dateien")}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {preview.coverCandidates.length ? (
        <label>
          {text("Collection cover", "Collection-Cover")}
          <select
            value={coverSourceName}
            onChange={(event) => onCoverSourceNameChange(event.target.value)}
          >
            <option value="">{text("No cover", "Kein Cover")}</option>
            {preview.coverCandidates.map((candidate) => (
              <option key={candidate.sourceName} value={candidate.sourceName}>
                {candidate.sourceName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
