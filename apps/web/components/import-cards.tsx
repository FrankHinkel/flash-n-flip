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
  cardContentSchema,
  type CardContent,
} from "@flashcards/domain/content";
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
import { formatByteSize } from "@flashcards/domain";
import { enqueueLocalAudioOptimization } from "../lib/audio-optimization";
import { LanguageDirectionFields } from "./language-direction-fields";
import { AnkiImportProfileEditor } from "./anki-import-profile-editor";
import {
  ankiImportLivePreviewRecords,
  ankiImportPreviewContentWithoutMedia,
  ankiImportPreviewMediaReferences,
  clampedAnkiImportPreviewRecordIndex,
  toggledAnkiImportPreviewDeck,
} from "./anki-import-live-preview";
import { ContentView } from "./content-view";
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

const previewAnkiCardContent = (content: AnkiCardContent): CardContent =>
  cardContentSchema.parse(ankiImportPreviewContentWithoutMedia(content));

function AnkiImportMediaPreview({
  content,
  media,
  text,
}: {
  content: AnkiCardContent;
  media: LocalImportMedia[];
  text: (english: string, german: string) => string;
}) {
  const references = useMemo(
    () => ankiImportPreviewMediaReferences(content),
    [content],
  );
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const mediaByName = new Map(media.map((item) => [item.sourceName, item]));
    const names = new Set(
      references.flatMap((reference) =>
        reference.kind === "imageOverlay"
          ? [reference.baseSourceName, reference.overlaySourceName]
          : [reference.sourceName],
      ),
    );
    const next = new Map<string, string>();
    for (const name of names) {
      const item = mediaByName.get(name);
      if (!item || (item.kind !== "image" && item.kind !== "audio")) continue;
      const bytes = item.bytes.buffer.slice(
        item.bytes.byteOffset,
        item.bytes.byteOffset + item.bytes.byteLength,
      ) as ArrayBuffer;
      next.set(
        name,
        URL.createObjectURL(new Blob([bytes], { type: item.mimeType })),
      );
    }
    setObjectUrls(next);
    return () => {
      for (const url of next.values()) URL.revokeObjectURL(url);
    };
  }, [media, references]);

  const visibleReferences = references.filter((reference) =>
    reference.kind === "imageOverlay"
      ? objectUrls.has(reference.baseSourceName) &&
        objectUrls.has(reference.overlaySourceName)
      : objectUrls.has(reference.sourceName),
  );
  if (!visibleReferences.length) return null;

  return (
    <div className="anki-live-media-preview">
      {visibleReferences.map((reference, index) => {
        if (reference.kind === "image") {
          return (
            <figure key={`${reference.sourceName}-${index}`}>
              <img
                src={objectUrls.get(reference.sourceName)}
                alt={
                  reference.decorative
                    ? ""
                    : text(
                        "Imported image preview",
                        "Vorschau des importierten Bildes",
                      )
                }
              />
            </figure>
          );
        }
        if (reference.kind === "audio") {
          return (
            <figure key={`${reference.sourceName}-${index}`}>
              <figcaption>
                {text("Imported audio", "Importiertes Audio")}
              </figcaption>
              <audio
                aria-label={text(
                  "Imported audio preview",
                  "Vorschau des importierten Audios",
                )}
                controls
                preload="none"
                src={objectUrls.get(reference.sourceName)}
              />
            </figure>
          );
        }
        return (
          <figure
            className="anki-live-image-overlay"
            key={`${reference.baseSourceName}-${reference.overlaySourceName}-${index}`}
          >
            <span
              role={reference.decorative ? undefined : "img"}
              aria-label={
                reference.decorative
                  ? undefined
                  : text(
                      "Imported image overlay preview",
                      "Vorschau der importierten Bildverdeckung",
                    )
              }
              aria-hidden={reference.decorative || undefined}
            >
              <img
                aria-hidden="true"
                src={objectUrls.get(reference.baseSourceName)}
                alt=""
              />
              <img
                aria-hidden="true"
                src={objectUrls.get(reference.overlaySourceName)}
                alt=""
              />
            </span>
          </figure>
        );
      })}
    </div>
  );
}

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
  const [existingImport, setExistingImport] = useState<{
    exists: boolean;
    cardCount: number;
  } | null>(null);
  const [reimportMode, setReimportMode] = useState<"UPDATE" | "COPY">("UPDATE");
  const [commitPlan, setCommitPlan] = useState<{
    fingerprint: string;
    parsed: LocalFileImport;
  } | null>(null);

  const selectionFingerprint = () =>
    JSON.stringify({
      file: file
        ? { name: file.name, size: file.size, lastModified: file.lastModified }
        : null,
      format,
      sourceLocale,
      targetLocale,
      includedSourceDeckIds,
      mappings,
      subdeckFields,
      profileSelection,
      includedMediaGroupIds,
      coverSourceName,
      reimportMode,
    });

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
    setPreviewBusy(false);
    setMappings({});
    setIncludedSourceDeckIds([]);
    setSubdeckFields({});
    setProfileSelection(undefined);
    setIncludedMediaGroupIds([]);
    setCoverSourceName("");
    setExistingImport(null);
    setReimportMode("UPDATE");
    setCommitPlan(null);
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
      const fingerprint = selectionFingerprint();
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
      if (!commitPlan || commitPlan.fingerprint !== fingerprint) {
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
                    signal: controller.signal,
                    onProgress: setLocalProgress,
                  },
                )
              : await parseLocalFlashNFlipPackage(file);
        setWarnings(parsed.warnings);
        setCommitPlan({ fingerprint, parsed });
        activeParser.current = null;
        setLocalProgress(null);
        return;
      }
      const parsed = commitPlan.parsed;
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
                setExistingImport(null);
                setReimportMode("UPDATE");
                setCommitPlan(null);
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

        {format === "APKG" && existingImport?.exists ? (
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

        {prepared?.parsed.ankiPreview && format === "APKG" ? (
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
            includedMediaGroupIds={includedMediaGroupIds}
            onIncludedMediaGroupIdsChange={setIncludedMediaGroupIds}
            coverSourceName={coverSourceName}
            onCoverSourceNameChange={setCoverSourceName}
            locale={locale}
            text={text}
          />
        ) : null}

        {commitPlan && commitPlan.fingerprint === selectionFingerprint() ? (
          <section
            className="anki-commit-summary"
            aria-labelledby="anki-commit-summary-title"
          >
            <div>
              <span className="eyebrow">
                {text("Ready for local commit", "Bereit zum lokalen Speichern")}
              </span>
              <h2 id="anki-commit-summary-title">
                {text("Final import summary", "Endgültige Importübersicht")}
              </h2>
            </div>
            <dl>
              <div>
                <dt>{text("Target decks", "Zieldecks")}</dt>
                <dd>{commitPlan.parsed.decks.length.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>{text("Generated cards", "Erzeugte Karten")}</dt>
                <dd>
                  {commitPlan.parsed.decks
                    .reduce((count, deck) => count + deck.cards.length, 0)
                    .toLocaleString(locale)}
                </dd>
              </div>
              <div>
                <dt>{text("Selected media", "Ausgewählte Medien")}</dt>
                <dd>
                  {commitPlan.parsed.media.length.toLocaleString(locale)} ·{" "}
                  {formatByteSize(
                    commitPlan.parsed.media.reduce(
                      (bytes, medium) => bytes + medium.bytes.byteLength,
                      0,
                    ),
                    locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>{text("Profile", "Profil")}</dt>
                <dd>
                  {profileSelection?.kind === "CUSTOM"
                    ? profileSelection.profile.name
                    : profileSelection?.kind === "BUILT_IN" &&
                        profileSelection.profileId === xefjordAnkiProfileId
                      ? "Xefjord's Complete"
                      : profileSelection?.kind === "BUILT_IN" &&
                          profileSelection.profileId ===
                            manualAnkiFieldMappingProfileId
                        ? text(
                            "Manual field correction",
                            "Manuelle Feldkorrektur",
                          )
                        : text(
                            "Automatic Anki templates",
                            "Automatische Anki-Vorlagen",
                          )}
                </dd>
              </div>
              <div>
                <dt>{text("Notices", "Hinweise")}</dt>
                <dd>
                  {commitPlan.parsed.warnings.length.toLocaleString(locale)}
                </dd>
              </div>
            </dl>
            <p>
              {text(
                "No cards or media have been written yet. Confirm with “Import locally”.",
                "Es wurden noch keine Karten oder Medien geschrieben. Bestätige mit „Lokal importieren“.",
              )}
            </p>
          </section>
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
            : format !== "CSV" &&
                (!commitPlan ||
                  commitPlan.fingerprint !== selectionFingerprint())
              ? text("Prepare final summary", "Endübersicht vorbereiten")
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
  includedMediaGroupIds,
  onIncludedMediaGroupIdsChange,
  coverSourceName,
  onCoverSourceNameChange,
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
  includedMediaGroupIds: string[];
  onIncludedMediaGroupIdsChange: Dispatch<SetStateAction<string[]>>;
  coverSourceName: string;
  onCoverSourceNameChange: Dispatch<SetStateAction<string>>;
  locale: string;
  text: (english: string, german: string) => string;
}) {
  const [openPreviewDeckId, setOpenPreviewDeckId] = useState<string | null>(
    null,
  );
  const [previewRecordIndex, setPreviewRecordIndex] = useState(0);
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
    setOpenPreviewDeckId(null);
    setPreviewRecordIndex(0);
  }, [preview.sha256]);

  const togglePreviewDeck = (sourceDeckId: string) => {
    setOpenPreviewDeckId((current) =>
      toggledAnkiImportPreviewDeck(current, sourceDeckId),
    );
    setPreviewRecordIndex(0);
  };

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
        className="anki-usage-analysis"
        aria-labelledby="anki-usage-title"
      >
        <div>
          <h3 id="anki-usage-title">
            {text(
              "How the package creates cards",
              "Wie das Paket Karten erzeugt",
            )}
          </h3>
          <p>
            {text(
              "Open one deck to browse every record and inspect its generated cards. Selecting the open deck again closes it.",
              "Öffne ein Deck, um ohne Vorschau-Limit durch alle Datensätze und ihre erzeugten Karten zu blättern. Ein erneuter Klick schließt das Deck.",
            )}
          </p>
        </div>
        {preview.usage.map((deck, deckIndex) => {
          const isOpen = openPreviewDeckId === deck.sourceDeckId;
          const panelId = `anki-live-preview-deck-${deckIndex}`;
          return (
            <section className="anki-usage-deck" key={deck.sourceDeckId}>
              <h4>
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

                      {Object.keys(previewRecord.sourceFieldText).length ? (
                        <details className="anki-live-source-fields">
                          <summary>
                            {text(
                              "Inspect sanitized source fields",
                              "Bereinigte Quellfelder prüfen",
                            )}
                          </summary>
                          <dl>
                            {Object.entries(previewRecord.sourceFieldText).map(
                              ([name, value]) => (
                                <div key={name}>
                                  <dt>{name}</dt>
                                  <dd>{value || "—"}</dd>
                                </div>
                              ),
                            )}
                          </dl>
                        </details>
                      ) : null}

                      {previewRecord.tags.length ? (
                        <p className="anki-live-record-tags">
                          <strong>{text("Tags", "Schlagwörter")}:</strong>{" "}
                          {previewRecord.tags.join(", ")}
                        </p>
                      ) : null}

                      <div className="anki-live-generated-cards">
                        {previewRecord.cards.map((card, cardIndex) => (
                          <article key={`${card.sourceId}-${cardIndex}`}>
                            <header>
                              <strong>
                                {card.sourceTemplateName ||
                                  text("Generated card", "Erzeugte Karte")}
                              </strong>
                              <small>
                                {text("Card", "Karte")} {cardIndex + 1}{" "}
                                {text("of", "von")} {previewRecord.cards.length}
                              </small>
                            </header>
                            <div className="anki-profile-card-preview">
                              <section>
                                <strong>{text("Question", "Frage")}</strong>
                                <ContentView
                                  content={previewAnkiCardContent(
                                    card.front as unknown as AnkiCardContent,
                                  )}
                                  speechEnabled={false}
                                />
                                <AnkiImportMediaPreview
                                  content={
                                    card.front as unknown as AnkiCardContent
                                  }
                                  media={previewMedia}
                                  text={text}
                                />
                              </section>
                              <section>
                                <strong>{text("Answer", "Antwort")}</strong>
                                <ContentView
                                  content={previewAnkiCardContent(
                                    card.back as unknown as AnkiCardContent,
                                  )}
                                  answer
                                  speechEnabled={false}
                                />
                                <AnkiImportMediaPreview
                                  content={
                                    card.back as unknown as AnkiCardContent
                                  }
                                  media={previewMedia}
                                  text={text}
                                />
                              </section>
                            </div>
                          </article>
                        ))}
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
        mappings={mappings}
        selection={profileSelection}
        onSelectionChange={onProfileSelectionChange}
        text={text}
      />

      {profileSelection?.kind !== "CUSTOM" &&
      !(
        profileSelection?.kind === "BUILT_IN" &&
        profileSelection.profileId === manualAnkiFieldMappingProfileId
      ) ? (
        <p className="form-hint anki-automatic-import-note">
          {text(
            "Automatic mode preserves the generated Anki cards, all sanitized note fields and referenced local media. Field roles below are only shown after choosing manual correction.",
            "Der Automatikmodus übernimmt die von Anki erzeugten Karten, alle bereinigten Notizfelder und referenzierten lokalen Medien. Feldrollen werden erst bei manueller Korrektur eingeblendet.",
          )}
        </p>
      ) : null}

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
                <strong>
                  {group.fieldName === "__anki_template__"
                    ? text("Anki template", "Anki-Vorlage")
                    : group.fieldName}
                </strong>
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
