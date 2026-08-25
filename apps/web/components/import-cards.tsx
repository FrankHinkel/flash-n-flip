"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  FileSpreadsheet,
  FileUp,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

import {
  detectAnkiPreviewLanguageDirection,
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
  type LocalAnkiImportProgress,
  type LocalImportDeck,
  type LocalImportMedia,
  type LocalFileImport,
} from "../lib/local-file-import";
import type {
  AnkiFieldRole,
  AnkiImportPreview,
} from "@flashcards/domain/anki-import-plan";
import type { AnkiCardContent } from "@flashcards/domain/anki-import-types";
import {
  manualAnkiFieldMappingProfileId,
  xefjordAnkiProfileId,
  ankiSourceDeckPathMatches,
  type AnkiImportProfileSelection,
} from "@flashcards/domain/anki-import-profile";
import {
  importLocalFilePackage,
  importLocalTextDeck,
  localAnkiImportStatus,
} from "../lib/local-product-repository";
import { parseLocalDelimitedCards } from "../lib/local-text-import";
import { refreshLocalXefjordPhraseIndexes } from "../lib/local-xefjord-cross-language";
import { formatByteSize } from "@flashcards/domain";
import { enqueueLocalAudioOptimization } from "../lib/audio-optimization";
import { LanguageDirectionFields } from "./language-direction-fields";
import {
  AnkiImportProfileEditor,
  AnkiWikiTemplateEditor,
  type AnkiWikiEditorTarget,
  type AnkiWikiLivePreview,
} from "./anki-import-profile-editor";
import { AnkiImportContentPreview } from "./anki-import-content-preview";
import { AnkiImportSourceFields } from "./anki-import-source-fields";
import {
  ankiImportLivePreviewRecords,
  clampedAnkiImportPreviewRecordIndex,
  toggledAnkiImportPreviewDeck,
} from "./anki-import-live-preview";
import { hasPreservedAnkiLayout } from "./anki-field-mapping";
import { useI18n } from "./i18n-provider";

export type ImportFormat = "CSV" | "APKG" | "FNF";

export const importFormatOrder = ["FNF", "APKG", "CSV"] as const satisfies
  readonly ImportFormat[];
export const defaultImportFormat: ImportFormat = importFormatOrder[0];

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

const progressLabel = (
  phase: LocalAnkiImportProgress["phase"],
  text: (english: string, german: string) => string,
) =>
  phase === "READING_ARCHIVE"
    ? text("Reading package", "Paket wird gelesen")
    : phase === "UNPACKING"
      ? text("Unpacking safely", "Wird sicher entpackt")
      : phase === "READING_DATABASE"
        ? text("Opening collection", "Sammlung wird geöffnet")
        : phase === "READING_MEDIA"
          ? text("Checking media", "Medien werden geprüft")
          : phase === "READING_CARDS"
            ? text("Analyzing cards", "Karten werden analysiert")
            : phase === "BUILDING_PREVIEW"
              ? text("Building analysis", "Analyse wird aufgebaut")
              : text(
                  "Preparing card layouts",
                  "Kartenlayouts werden vorbereitet",
                );

export function ImportCards() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [format, setFormat] = useState<ImportFormat>(defaultImportFormat);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceLocale, setSourceLocale] = useState<string>(locale);
  const [targetLocale, setTargetLocale] = useState<string>(
    locale === "de" ? "en" : "de",
  );
  const [autoDetectedDirection, setAutoDetectedDirection] = useState(false);
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
  const activeParser = useRef<AbortController | null>(null);
  const [status, setStatus] = useState("");
  const [localProgress, setLocalProgress] =
    useState<LocalAnkiImportProgress | null>(null);
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
  const [includeReverseCards, setIncludeReverseCards] = useState(false);
  const [existingImport, setExistingImport] = useState<{
    exists: boolean;
    cardCount: number;
  } | null>(null);
  const [reimportMode, setReimportMode] = useState<"UPDATE" | "COPY">("UPDATE");
  const selectFormat = (next: ImportFormat) => {
    activeParser.current?.abort();
    activeParser.current = null;
    previewRequest.current += 1;
    setFormat(next);
    setFile(null);
    setContent("");
    setError("");
    setWarnings([]);
    setStatus("");
    setLocalProgress(null);
    setPrepared(null);
    setAutoDetectedDirection(false);
    setPreviewBusy(false);
    setMappings({});
    setIncludedSourceDeckIds([]);
    setSubdeckFields({});
    setProfileSelection(undefined);
    setIncludedMediaGroupIds([]);
    setCoverSourceName("");
    setIncludeReverseCards(false);
    setExistingImport(null);
    setReimportMode("UPDATE");
  };

  const preparePreview = async (
    selectedFile: File,
    selectedFormat: Exclude<ImportFormat, "CSV">,
  ) => {
    activeParser.current?.abort();
    const controller = new AbortController();
    activeParser.current = controller;
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
          ? await parseLocalAnkiPackage(
              selectedFile,
              {
                sourceLocale,
                targetLocale,
              },
              {
                signal: controller.signal,
                onProgress: setLocalProgress,
              },
            )
          : await parseLocalFlashNFlipPackage(selectedFile);
      if (request !== previewRequest.current) return;
      const detected = parsed.ankiPreview
        ? detectAnkiPreviewLanguageDirection(parsed.ankiPreview)
        : null;
      const resolvedSource =
        detected?.sourceLocale ?? parsed.suggestedSourceLocale ?? sourceLocale;
      const resolvedTarget =
        detected?.targetLocale ?? parsed.suggestedTargetLocale ?? targetLocale;
      setAutoDetectedDirection(Boolean(detected));
      setSourceLocale(resolvedSource);
      setTargetLocale(resolvedTarget);
      setPrepared({
        file: selectedFile,
        parsed,
        sourceLocale: resolvedSource,
        targetLocale: resolvedTarget,
      });
      if (parsed.sourceCollectionKey) {
        const existing = await localAnkiImportStatus(
          parsed.sourceCollectionKey,
        );
        if (request !== previewRequest.current) return;
        setExistingImport(existing);
      } else {
        setExistingImport(null);
      }
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
        setLocalProgress(null);
        if (activeParser.current === controller) activeParser.current = null;
      }
    }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let controller: AbortController | null = null;
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
      controller = new AbortController();
      activeParser.current = controller;
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
                  includeReverseCards,
                  signal: controller.signal,
                  onProgress: setLocalProgress,
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
        reimportMode,
      });
      if (parsed.importProfile === "XEFJORD") {
        try {
          await refreshLocalXefjordPhraseIndexes(result.deckId, {
            forceDeckIds: result.dictionaryDeckIds,
          });
        } catch {
          // The derived index is rebuilt lazily; a cache failure must not turn
          // an already committed import into an apparent import failure.
        }
      }
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
      if (controller && activeParser.current === controller) {
        activeParser.current = null;
      }
      setLocalProgress(null);
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
              "FNF, Anki APKG, CSV, media, and original audio are processed only on this device and are never uploaded.",
              "FNF, Anki APKG, CSV, Medien und Originalaudio werden ausschließlich auf diesem Gerät verarbeitet und nie hochgeladen.",
            )}
          </p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        <fieldset className="import-format-picker">
          <legend>{text("Import format", "Importformat")}</legend>
          <div>
            {importFormatOrder.map((value) => {
              const option =
                value === "FNF"
                  ? {
                      value,
                      icon: FileArchive,
                      title: "Flash-n-Flip",
                      description: text(
                        "Portable local .fnf package",
                        "Portables lokales .fnf-Paket",
                      ),
                    }
                  : value === "APKG"
                    ? {
                        value,
                        icon: FileUp,
                        title: "Anki APKG",
                        description: text(
                          "Classic and current packages",
                          "Klassische und aktuelle Pakete",
                        ),
                      }
                    : {
                        value,
                        icon: FileSpreadsheet,
                        title: "CSV / TSV",
                        description: text(
                          "Question and answer text",
                          "Frage- und Antworttext",
                        ),
                      };
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
              {file?.name ??
                (format === "APKG"
                  ? text("Open Anki deck", "Anki-Deck öffnen")
                  : text("Choose file", "Datei auswählen"))}
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
              accept={format === "APKG" ? ".apkg,.APKG" : ".fnf,.FNF"}
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
                setExistingImport(null);
                setReimportMode("UPDATE");
                activeParser.current?.abort();
                activeParser.current = null;
                setLocalProgress(null);
                if (selectedFile) {
                  void preparePreview(selectedFile, format);
                }
              }}
            />
          </label>
        )}

        {format !== "APKG" ? (
          <LanguageDirectionFields
            sourceLocale={sourceLocale}
            targetLocale={targetLocale}
            onSourceLocaleChange={(value) => {
              setAutoDetectedDirection(false);
              setSourceLocale(value);
            }}
            onTargetLocaleChange={(value) => {
              setAutoDetectedDirection(false);
              setTargetLocale(value);
            }}
            uiLocale={locale}
            disabled={busy || previewBusy}
          />
        ) : null}

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
                `${prepared.parsed.decks.length.toLocaleString("en")} decks, ${prepared.parsed.decks.reduce((count, deck) => count + deck.cards.length, 0).toLocaleString("en")} cards and ${prepared.parsed.media.length.toLocaleString("en")} media files · ${formatByteSize(prepared.file.size, "en")} · ${sourceLocale}${sourceLocale === targetLocale ? "" : ` → ${targetLocale}`}.${format === "APKG" && existingImport?.exists ? " The existing collection will be updated and its learning progress preserved." : ""}`,
                `${prepared.parsed.decks.length.toLocaleString("de-DE")} Lernsets, ${prepared.parsed.decks.reduce((count, deck) => count + deck.cards.length, 0).toLocaleString("de-DE")} Karten und ${prepared.parsed.media.length.toLocaleString("de-DE")} Mediendateien · ${formatByteSize(prepared.file.size, "de")} · ${sourceLocale}${sourceLocale === targetLocale ? "" : ` → ${targetLocale}`}.${format === "APKG" && existingImport?.exists ? " Die vorhandene Sammlung wird aktualisiert und ihr Lernfortschritt bleibt erhalten." : ""}`,
              )}
            </span>
          </section>
        ) : null}

        {format === "APKG" && prepared?.parsed.ankiPreview ? (
          <details
            key={`${prepared.file.name}-${prepared.file.lastModified}`}
            className="anki-import-options"
          >
            <summary>
              <span>
                <strong>{text("Options", "Optionen")}</strong>
                <small>
                  {text(
                    "Automatic import is ready. Open only to change decks, languages, templates, media, or update behavior.",
                    "Der automatische Import ist bereit. Nur öffnen, um Lernsets, Sprachen, Vorlagen, Medien oder das Aktualisierungsverhalten zu ändern.",
                  )}
                </small>
              </span>
              <ChevronDown aria-hidden="true" size={22} />
            </summary>
            <div className="anki-import-options-panel">
              <LanguageDirectionFields
                sourceLocale={sourceLocale}
                targetLocale={targetLocale}
                onSourceLocaleChange={(value) => {
                  setAutoDetectedDirection(false);
                  setSourceLocale(value);
                }}
                onTargetLocaleChange={(value) => {
                  setAutoDetectedDirection(false);
                  setTargetLocale(value);
                }}
                uiLocale={locale}
                disabled={busy || previewBusy}
              />
              {autoDetectedDirection ? (
                <small role="status">
                  {text(
                    "Languages detected from a small local sample. You can change them before importing.",
                    "Sprachen aus einer kleinen lokalen Stichprobe erkannt. Du kannst sie vor dem Import ändern.",
                  )}
                </small>
              ) : null}
              {existingImport?.exists ? (
                <fieldset className="anki-reimport-choice">
                  <legend>
                    {text(
                      "This Anki collection already exists",
                      "Diese Anki-Sammlung ist bereits vorhanden",
                    )}
                  </legend>
                  <p>
                    {text(
                      `${existingImport.cardCount.toLocaleString("en")} existing cards were recognized. Updating preserves their learning progress and keeps removed source cards until you explicitly clean them up.`,
                      `${existingImport.cardCount.toLocaleString("de-DE")} vorhandene Karten wurden erkannt. Eine Aktualisierung erhält ihren Lernfortschritt und bewahrt entfernte Quellkarten, bis du sie ausdrücklich bereinigst.`,
                    )}
                  </p>
                  <label>
                    <input
                      type="radio"
                      name="anki-reimport-mode"
                      checked={reimportMode === "UPDATE"}
                      onChange={() => setReimportMode("UPDATE")}
                    />
                    <span>
                      <strong>
                        {text(
                          "Update existing collection",
                          "Vorhandene Sammlung aktualisieren",
                        )}
                      </strong>
                      <small>
                        {text(
                          "Stable cards keep their progress; unchanged cards are not written again.",
                          "Stabile Karten behalten ihren Fortschritt; unveränderte Karten werden nicht erneut geschrieben.",
                        )}
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="anki-reimport-mode"
                      checked={reimportMode === "COPY"}
                      onChange={() => setReimportMode("COPY")}
                    />
                    <span>
                      <strong>
                        {text("Import as a copy", "Als Kopie importieren")}
                      </strong>
                      <small>
                        {text(
                          "Creates a separate lineage with new cards and new progress.",
                          "Erstellt eine getrennte Herkunft mit neuen Karten und neuem Lernfortschritt.",
                        )}
                      </small>
                    </span>
                  </label>
                </fieldset>
              ) : null}
              <AnkiImportOptions
                preview={prepared.parsed.ankiPreview}
                previewDecks={prepared.parsed.decks}
                previewMedia={prepared.parsed.media}
                mappings={mappings}
                onMappingsChange={setMappings}
                includedSourceDeckIds={includedSourceDeckIds}
                onIncludedSourceDeckIdsChange={setIncludedSourceDeckIds}
                subdeckFields={subdeckFields}
                onSubdeckFieldsChange={setSubdeckFields}
                profileSelection={profileSelection}
                onProfileSelectionChange={setProfileSelection}
                coverSourceName={coverSourceName}
                onCoverSourceNameChange={setCoverSourceName}
                includeReverseCards={includeReverseCards}
                onIncludeReverseCardsChange={setIncludeReverseCards}
                locale={locale}
                text={text}
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
            </div>
          </details>
        ) : null}

        {format !== "APKG" ? (
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
        ) : null}

        {status ? (
          <p role="status" aria-live="polite" className="form-hint">
            {status}
          </p>
        ) : null}
        {localProgress ? (
          <div className="import-progress" role="status" aria-live="polite">
            <div>
              <strong>{progressLabel(localProgress.phase, text)}</strong>
              {localProgress.total ? (
                <span>
                  {Math.round(
                    (localProgress.completed / localProgress.total) * 100,
                  )}
                  %
                </span>
              ) : null}
            </div>
            {localProgress.total ? (
              <progress
                max={localProgress.total}
                value={localProgress.completed}
              />
            ) : (
              <progress />
            )}
            <button
              type="button"
              className="button button-secondary"
              onClick={() => activeParser.current?.abort()}
            >
              {text("Cancel local processing", "Lokale Verarbeitung abbrechen")}
            </button>
          </div>
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
        {format === "FNF" ? (
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
  previewDecks,
  previewMedia,
  mappings,
  onMappingsChange,
  includedSourceDeckIds,
  onIncludedSourceDeckIdsChange,
  subdeckFields,
  onSubdeckFieldsChange,
  profileSelection,
  onProfileSelectionChange,
  coverSourceName,
  onCoverSourceNameChange,
  includeReverseCards,
  onIncludeReverseCardsChange,
  locale,
  text,
}: {
  preview: AnkiImportPreview;
  previewDecks: LocalImportDeck[];
  previewMedia: LocalImportMedia[];
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
  coverSourceName: string;
  onCoverSourceNameChange: Dispatch<SetStateAction<string>>;
  includeReverseCards: boolean;
  onIncludeReverseCardsChange: Dispatch<SetStateAction<boolean>>;
  locale: string;
  text: (english: string, german: string) => string;
}) {
  const [usageAnalysisOpen, setUsageAnalysisOpen] = useState(false);
  const [openPreviewDeckId, setOpenPreviewDeckId] = useState<string | null>(
    null,
  );
  const [previewRecordIndex, setPreviewRecordIndex] = useState(0);
  const [wikiEditorTarget, setWikiEditorTarget] =
    useState<AnkiWikiEditorTarget | null>(null);
  const [wikiLivePreview, setWikiLivePreview] =
    useState<AnkiWikiLivePreview | null>(null);
  const openPreviewDeck = useMemo(
    () => previewDecks.find((deck) => deck.sourceId === openPreviewDeckId),
    [openPreviewDeckId, previewDecks],
  );
  const previewRecords = useMemo(
    () => ankiImportLivePreviewRecords(openPreviewDeck),
    [openPreviewDeck],
  );
  const safePreviewRecordIndex = clampedAnkiImportPreviewRecordIndex(
    previewRecordIndex,
    previewRecords.length,
  );
  const previewRecord = previewRecords[safePreviewRecordIndex];

  useEffect(() => {
    setUsageAnalysisOpen(false);
    setOpenPreviewDeckId(null);
    setPreviewRecordIndex(0);
    setWikiEditorTarget(null);
    setWikiLivePreview(null);
  }, [preview.sha256]);

  useEffect(() => {
    setWikiEditorTarget(null);
    setWikiLivePreview(null);
  }, [openPreviewDeckId, safePreviewRecordIndex]);

  const togglePreviewDeck = (sourceDeckId: string) => {
    setOpenPreviewDeckId((current) =>
      toggledAnkiImportPreviewDeck(current, sourceDeckId),
    );
    setPreviewRecordIndex(0);
    setWikiEditorTarget(null);
    setWikiLivePreview(null);
  };

  const closeWikiEditor = () => {
    setWikiEditorTarget(null);
    setWikiLivePreview(null);
  };

  const toggleWikiEditor = (target: AnkiWikiEditorTarget) => {
    const isCurrent = wikiEditorTarget?.card.sourceId === target.card.sourceId;
    setWikiLivePreview(null);
    setWikiEditorTarget(isCurrent ? null : target);
  };

  const setSourceDeckIncluded = (sourceDeckId: string, included: boolean) =>
    onIncludedSourceDeckIdsChange((current) =>
      included
        ? current.includes(sourceDeckId)
          ? current
          : [...current, sourceDeckId]
        : current.filter((id) => id !== sourceDeckId),
    );

  const resolvedUsageStatus = (
    path: readonly string[],
    noteType: AnkiImportPreview["usage"][number]["noteTypes"][number],
    template: AnkiImportPreview["usage"][number]["noteTypes"][number]["templates"][number],
  ):
    | "AUTOMATIC"
    | "MANUAL"
    | "PROFILE"
    | "STRUCTURAL_ADAPTER"
    | "UNRESOLVED" => {
    if (
      profileSelection?.kind === "BUILT_IN" &&
      profileSelection.profileId === manualAnkiFieldMappingProfileId
    ) {
      return "MANUAL";
    }
    if (
      profileSelection?.kind === "BUILT_IN" &&
      profileSelection.profileId === xefjordAnkiProfileId
    ) {
      return "STRUCTURAL_ADAPTER";
    }
    if (
      profileSelection?.kind === "CUSTOM" &&
      profileSelection.profile.rules.some(
        (rule) =>
          rule.noteTypeName.toLocaleLowerCase() ===
            noteType.name.toLocaleLowerCase() &&
          (!rule.noteTypeSignature ||
            rule.noteTypeSignature === noteType.signature) &&
          ankiSourceDeckPathMatches(rule.sourceDeckPath, path) &&
          (!rule.sourceTemplate ||
            ((rule.sourceTemplate.ord === undefined ||
              rule.sourceTemplate.ord === template.ord) &&
              (rule.sourceTemplate.name === undefined ||
                rule.sourceTemplate.name.toLocaleLowerCase() ===
                  template.name.toLocaleLowerCase()))),
      )
    ) {
      return "PROFILE";
    }
    return template.status;
  };

  const usageStatusLabel = (
    status: ReturnType<typeof resolvedUsageStatus>,
  ): string =>
    status === "PROFILE"
      ? text("Profile assigned", "Profil zugeordnet")
      : status === "MANUAL"
        ? text("Manual correction", "Manuelle Korrektur")
        : status === "STRUCTURAL_ADAPTER"
          ? text("Structural adapter", "Sonderadapter")
          : status === "AUTOMATIC"
            ? text("Automatic", "Automatisch")
            : text("Unresolved", "Ungeklärt");

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

      <section
        className={`anki-usage-analysis${usageAnalysisOpen ? " is-open" : ""}`}
        aria-labelledby="anki-usage-title"
      >
        <h3 id="anki-usage-title">
          <button
            type="button"
            className="anki-usage-analysis-toggle"
            aria-expanded={usageAnalysisOpen}
            onClick={() => setUsageAnalysisOpen((current) => !current)}
          >
            <span>
              <strong>
                {text(
                  "How the package creates cards",
                  "Wie das Paket Karten erzeugt",
                )}
              </strong>
              <small>
                {preview.deckCount.toLocaleString(locale)}{" "}
                {text("decks", "Lernsets")} ·{" "}
                {preview.cardCount.toLocaleString(locale)}{" "}
                {text("cards", "Karten")}
              </small>
            </span>
            <ChevronDown aria-hidden="true" size={22} />
          </button>
        </h3>
        <p>
          {text(
            "Open one deck to browse every record and inspect its generated cards. Selecting the open deck again closes it.",
            "Öffne ein Deck, um ohne Vorschau-Limit durch alle Datensätze und ihre erzeugten Karten zu blättern. Ein erneuter Klick schließt das Deck.",
          )}
        </p>
        <div
          className="anki-source-deck-actions anki-source-deck-actions-compact"
          role="group"
          aria-label={text("Select Anki decks", "Anki-Stapel auswählen")}
        >
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
        {preview.usage.map((deck, deckIndex) => {
          const isOpen = openPreviewDeckId === deck.sourceDeckId;
          const isIncluded = includedSourceDeckIds.includes(deck.sourceDeckId);
          const panelId = `anki-live-preview-deck-${deckIndex}`;
          return (
            <section className="anki-usage-deck" key={deck.sourceDeckId}>
              <h4>
                <label className="anki-usage-deck-checkbox">
                  <input
                    type="checkbox"
                    checked={isIncluded}
                    onChange={(event) =>
                      setSourceDeckIncluded(
                        deck.sourceDeckId,
                        event.target.checked,
                      )
                    }
                  />
                  <span className="sr-only">
                    {text(
                      `Import deck ${deck.path.join(" / ")}`,
                      `Deck ${deck.path.join(" / ")} importieren`,
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  className="anki-usage-deck-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => togglePreviewDeck(deck.sourceDeckId)}
                >
                  <span>
                    <strong>{deck.path.join(" › ")}</strong>
                    <small>
                      {deck.cardCount.toLocaleString(locale)}{" "}
                      {text("cards", "Karten")}
                    </small>
                  </span>
                  <ChevronDown aria-hidden="true" size={20} />
                </button>
              </h4>
              {isOpen ? (
                <div className="anki-usage-deck-panel" id={panelId}>
                  {previewRecord ? (
                    <section
                      className="anki-live-record"
                      aria-labelledby={`${panelId}-title`}
                    >
                      <div className="anki-live-record-heading">
                        <div>
                          <span className="eyebrow">
                            {text("Live preview", "Live-Vorschau")}
                          </span>
                          <h5 id={`${panelId}-title`} aria-live="polite">
                            {text("Record", "Datensatz")}{" "}
                            {(safePreviewRecordIndex + 1).toLocaleString(
                              locale,
                            )}{" "}
                            {text("of", "von")}{" "}
                            {previewRecords.length.toLocaleString(locale)}
                          </h5>
                          <small>
                            {previewRecord.sourceNoteTypeName ??
                              text("Unknown note type", "Unbekannter Notiztyp")}
                            {" · "}
                            {previewRecord.cards.length.toLocaleString(
                              locale,
                            )}{" "}
                            {text(
                              previewRecord.cards.length === 1
                                ? "generated card"
                                : "generated cards",
                              previewRecord.cards.length === 1
                                ? "erzeugte Karte"
                                : "erzeugte Karten",
                            )}
                          </small>
                        </div>
                        <div
                          className="anki-live-record-navigation"
                          aria-label={text(
                            "Browse records",
                            "Durch Datensätze blättern",
                          )}
                        >
                          <button
                            type="button"
                            aria-label={text(
                              "Go to first record",
                              "Zum ersten Datensatz",
                            )}
                            title={text(
                              "Go to first record",
                              "Zum ersten Datensatz",
                            )}
                            disabled={safePreviewRecordIndex === 0}
                            onClick={() => setPreviewRecordIndex(0)}
                          >
                            <ChevronFirst aria-hidden="true" size={20} />
                          </button>
                          <button
                            type="button"
                            aria-label={text(
                              "Go to previous record",
                              "Zum vorherigen Datensatz",
                            )}
                            title={text(
                              "Go to previous record",
                              "Zum vorherigen Datensatz",
                            )}
                            disabled={safePreviewRecordIndex === 0}
                            onClick={() =>
                              setPreviewRecordIndex((current) =>
                                clampedAnkiImportPreviewRecordIndex(
                                  current - 1,
                                  previewRecords.length,
                                ),
                              )
                            }
                          >
                            <ChevronLeft aria-hidden="true" size={20} />
                          </button>
                          <label>
                            <span className="sr-only">
                              {text("Jump to record", "Zu Datensatz springen")}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={previewRecords.length}
                              inputMode="numeric"
                              value={safePreviewRecordIndex + 1}
                              aria-label={text(
                                "Current record number",
                                "Nummer des aktuellen Datensatzes",
                              )}
                              onChange={(event) =>
                                setPreviewRecordIndex(
                                  clampedAnkiImportPreviewRecordIndex(
                                    Number(event.target.value) - 1,
                                    previewRecords.length,
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={text(
                              "Go to next record",
                              "Zum nächsten Datensatz",
                            )}
                            title={text(
                              "Go to next record",
                              "Zum nächsten Datensatz",
                            )}
                            disabled={
                              safePreviewRecordIndex >=
                              previewRecords.length - 1
                            }
                            onClick={() =>
                              setPreviewRecordIndex((current) =>
                                clampedAnkiImportPreviewRecordIndex(
                                  current + 1,
                                  previewRecords.length,
                                ),
                              )
                            }
                          >
                            <ChevronRight aria-hidden="true" size={20} />
                          </button>
                          <button
                            type="button"
                            aria-label={text(
                              "Go to last record",
                              "Zum letzten Datensatz",
                            )}
                            title={text(
                              "Go to last record",
                              "Zum letzten Datensatz",
                            )}
                            disabled={
                              safePreviewRecordIndex >=
                              previewRecords.length - 1
                            }
                            onClick={() =>
                              setPreviewRecordIndex(previewRecords.length - 1)
                            }
                          >
                            <ChevronLast aria-hidden="true" size={20} />
                          </button>
                        </div>
                      </div>

                      <AnkiImportSourceFields
                        fields={previewRecord.sourceFieldRaw}
                        text={text}
                      />

                      {previewRecord.tags.length ? (
                        <p className="anki-live-record-tags">
                          <strong>{text("Tags", "Schlagwörter")}:</strong>{" "}
                          {previewRecord.tags.join(", ")}
                        </p>
                      ) : null}

                      <div className="anki-live-generated-cards">
                        {previewRecord.cards.map((card, cardIndex) => {
                          const isWikiEditing =
                            wikiEditorTarget?.card.sourceId === card.sourceId;
                          const liveFront =
                            isWikiEditing && wikiLivePreview?.front
                              ? wikiLivePreview.front
                              : (card.front as unknown as AnkiCardContent);
                          const liveBack =
                            isWikiEditing && wikiLivePreview?.back
                              ? wikiLivePreview.back
                              : (card.back as unknown as AnkiCardContent);
                          return (
                            <article key={`${card.sourceId}-${cardIndex}`}>
                              <header>
                                <strong>
                                  {card.sourceTemplateName ||
                                    text("Generated card", "Erzeugte Karte")}
                                </strong>
                                <div className="anki-live-card-header-actions">
                                  <small>
                                    {text("Card", "Karte")} {cardIndex + 1}{" "}
                                    {text("of", "von")}{" "}
                                    {previewRecord.cards.length}
                                  </small>
                                  <button
                                    type="button"
                                    aria-expanded={isWikiEditing}
                                    onClick={() =>
                                      toggleWikiEditor({
                                        deckPath: [...deck.path],
                                        card,
                                      })
                                    }
                                  >
                                    <Pencil aria-hidden="true" size={16} />
                                    {text(
                                      "Edit Wiki code",
                                      "Wiki-Code bearbeiten",
                                    )}
                                  </button>
                                </div>
                              </header>
                              <div className="anki-profile-card-preview">
                                <section>
                                  <strong>{text("Question", "Frage")}</strong>
                                  <AnkiImportContentPreview
                                    content={liveFront}
                                    media={previewMedia}
                                    text={text}
                                  />
                                </section>
                                <section>
                                  <strong>{text("Answer", "Antwort")}</strong>
                                  <AnkiImportContentPreview
                                    content={liveBack}
                                    answer
                                    media={previewMedia}
                                    text={text}
                                  />
                                </section>
                              </div>
                              {isWikiEditing && wikiLivePreview?.error ? (
                                <p className="form-error" role="alert">
                                  {wikiLivePreview.error}
                                </p>
                              ) : null}
                              {isWikiEditing ? (
                                <AnkiWikiTemplateEditor
                                  key={`${deck.sourceDeckId}-${card.sourceId}`}
                                  preview={preview}
                                  mappings={mappings}
                                  selection={profileSelection}
                                  target={wikiEditorTarget}
                                  media={previewMedia}
                                  onSelectionChange={onProfileSelectionChange}
                                  onPreviewChange={setWikiLivePreview}
                                  onClose={closeWikiEditor}
                                  text={text}
                                />
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <p>
                      {text(
                        "This deck contains no previewable records.",
                        "Dieses Deck enthält keine darstellbaren Datensätze.",
                      )}
                    </p>
                  )}

                  <div className="anki-usage-note-types">
                    {deck.noteTypes.map((noteType) => (
                      <section key={noteType.sourceNoteTypeId}>
                        <header>
                          <strong>{noteType.name}</strong>
                          <code>{noteType.signature}</code>
                        </header>
                        <ul>
                          {noteType.templates.map((template) => {
                            const status = resolvedUsageStatus(
                              deck.path,
                              noteType,
                              template,
                            );
                            return (
                              <li key={template.ord}>
                                <div className="anki-usage-template-heading">
                                  <span>
                                    <strong>{template.name}</strong>
                                    <small>
                                      {template.cardCount.toLocaleString(
                                        locale,
                                      )}{" "}
                                      {text("cards", "Karten")}
                                    </small>
                                  </span>
                                  <span
                                    className={`anki-usage-status is-${status.toLowerCase()}`}
                                  >
                                    {usageStatusLabel(status)}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
        {preview.unusedNoteTypes.length ? (
          <details>
            <summary>
              {preview.unusedNoteTypes.length.toLocaleString(locale)}{" "}
              {text("unused note types", "nicht verwendete Notiztypen")}
            </summary>
            <ul>
              {preview.unusedNoteTypes.map((noteType) => (
                <li key={noteType.sourceNoteTypeId}>
                  {noteType.name} · <code>{noteType.signature}</code>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <AnkiImportProfileEditor
        preview={preview}
        previewDecks={previewDecks}
        previewMedia={previewMedia}
        mappings={mappings}
        selection={profileSelection}
        onSelectionChange={onProfileSelectionChange}
        text={text}
      />

      {profileSelection?.kind !== "CUSTOM" &&
      !(
        profileSelection?.kind === "BUILT_IN" &&
        profileSelection.profileId === xefjordAnkiProfileId
      ) ? (
        <label className="checkbox-card">
          <input
            type="checkbox"
            checked={includeReverseCards}
            onChange={(event) =>
              onIncludeReverseCardsChange(event.target.checked)
            }
          />
          <span>
            <strong>
              {text(
                "Explicitly include detected reverse cards",
                "Erkannte Rückwärtskarten ausdrücklich einschließen",
              )}
            </strong>
            <small>
              {text(
                "Off by default. Independent Anki templates, cloze cards and image questions are still imported.",
                "Standardmäßig aus. Eigenständige Anki-Vorlagen, Lückentexte und Bildfragen werden weiterhin importiert.",
              )}
            </small>
          </span>
        </label>
      ) : null}

      {profileSelection?.kind !== "CUSTOM" &&
      !(
        profileSelection?.kind === "BUILT_IN" &&
        profileSelection.profileId === manualAnkiFieldMappingProfileId
      ) ? (
        <p className="form-hint anki-automatic-import-note">
          {text(
            "Automatic mode preserves the generated Anki cards, suspends detected reverse pairs by default, and keeps all sanitized note fields and referenced local media. Field roles below are only shown after choosing manual correction.",
            "Der Automatikmodus übernimmt die von Anki erzeugten Karten, setzt erkannte Rückwärtspaare standardmäßig aus und bewahrt alle bereinigten Notizfelder sowie referenzierten lokalen Medien. Feldrollen werden erst bei manueller Korrektur eingeblendet.",
          )}
        </p>
      ) : null}

      {preview.noteTypes
        .filter((noteType) => noteType.cardCount > 0)
        .map((noteType) => (
          <fieldset
            className="anki-note-mapping"
            key={noteType.sourceNoteTypeId}
          >
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
                  profileSelection?.kind === "BUILT_IN" &&
                  profileSelection.profileId ===
                    manualAnkiFieldMappingProfileId ? (
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
            {profileSelection?.kind === "BUILT_IN" &&
            profileSelection.profileId === manualAnkiFieldMappingProfileId &&
            noteType.omittedFields.length ? (
              <details className="anki-omitted-fields">
                <summary>
                  {noteType.omittedFields.length.toLocaleString(locale)}{" "}
                  {text(
                    "fields would currently be omitted",
                    "Felder würden derzeit ausgelassen",
                  )}
                </summary>
                <ul>
                  {noteType.omittedFields.map((field) => (
                    <li key={field.name}>
                      <strong>{field.name}</strong> ·{" "}
                      {field.distinctValueCount.toLocaleString(locale)}{" "}
                      {text("distinct values", "verschiedene Werte")}
                      {field.mediaCount
                        ? ` · ${field.mediaCount.toLocaleString(locale)} ${text("media", "Medien")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </fieldset>
        ))}

      {preview.warningGroups.length ? (
        <section
          className="anki-warning-groups"
          aria-labelledby="anki-warning-title"
        >
          <h3 id="anki-warning-title">
            {text("Grouped import notices", "Gruppierte Importhinweise")}
          </h3>
          {preview.warningGroups.map((group) => (
            <details key={group.kind}>
              <summary>
                <strong>{group.summary}</strong> ·{" "}
                {group.count.toLocaleString(locale)}
              </summary>
              <ul>
                {group.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
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
