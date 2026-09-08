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
import type { Locale, UiMessageKey } from "@flashcards/i18n";
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
import { useI18n, type I18nText } from "./i18n-provider";

export type ImportFormat = "CSV" | "APKG" | "FNF";

export const importFormatOrder = [
  "FNF",
  "APKG",
  "CSV",
] as const satisfies readonly ImportFormat[];
export const defaultImportFormat: ImportFormat = importFormatOrder[0];

const fieldRoleOptions = [
  { value: "PRIMARY_A", key: "anki.fieldRole.primaryA" },
  { value: "PRIMARY_B", key: "anki.fieldRole.primaryB" },
  { value: "MEDIA_A", key: "anki.fieldRole.mediaA" },
  { value: "MEDIA_B", key: "anki.fieldRole.mediaB" },
  { value: "HINT", key: "anki.fieldRole.hint" },
  { value: "HINT_MEDIA", key: "anki.fieldRole.hintMedia" },
  { value: "CATEGORY", key: "anki.fieldRole.category" },
  { value: "ORDER", key: "anki.fieldRole.order" },
  { value: "SOURCE_ID", key: "anki.fieldRole.sourceId" },
  { value: "IGNORE", key: "anki.fieldRole.ignore" },
] as const satisfies readonly { value: AnkiFieldRole; key: UiMessageKey }[];

const progressLabel = (
  phase: LocalAnkiImportProgress["phase"],
  text: I18nText,
) =>
  phase === "READING_ARCHIVE"
    ? text("legacy.aab4b9d05c51")
    : phase === "UNPACKING"
      ? text("legacy.bbc107f7327f")
      : phase === "READING_DATABASE"
        ? text("legacy.c336abb5fa6e")
        : phase === "READING_MEDIA"
          ? text("legacy.f1810e37e5c8")
          : phase === "READING_CARDS"
            ? text("legacy.82c182b92c43")
            : phase === "BUILDING_PREVIEW"
              ? text("legacy.7c214ca9b30e")
              : text("legacy.3ade9ac32145");

export function ImportCards() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [format, setFormat] = useState<ImportFormat>(defaultImportFormat);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceLocale, setSourceLocale] = useState<string>(locale);
  const [targetLocale, setTargetLocale] = useState<string>(
    locale === "en" ? "de" : "en",
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
    setStatus(text("legacy.6758a177343b"));
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
        cause instanceof Error ? cause.message : text("legacy.26f840ae51c9"),
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
        throw new Error(text("legacy.03383d343b0d"));
      }
      setStatus(text("legacy.9875cc3dd1d1"));
      if (format === "APKG" && includedSourceDeckIds.length === 0) {
        throw new Error(text("legacy.5833ce692235"));
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
      setStatus(text("legacy.a500a57e5bec"));
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
        cause instanceof Error ? cause.message : text("legacy.69395a7f8d4b"),
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
        <ArrowLeft size={16} /> {text("legacy.133ccb807081")}
      </Link>
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("legacy.e388e14b9940")}</span>
          <h1>{text("legacy.b2cc749dff43")}</h1>
          <p>{text("legacy.20e2f81ab59a")}</p>
        </div>
      </header>
      <form onSubmit={submit} className="import-form">
        <fieldset className="import-format-picker">
          <legend>{text("legacy.88775481ba42")}</legend>
          <div>
            {importFormatOrder.map((value) => {
              const option =
                value === "FNF"
                  ? {
                      value,
                      icon: FileArchive,
                      title: "Flash-n-Flip",
                      description: text("legacy.98fbf8890e4b"),
                    }
                  : value === "APKG"
                    ? {
                        value,
                        icon: FileUp,
                        title: "Anki APKG",
                        description: text("legacy.220f32f74146"),
                      }
                    : {
                        value,
                        icon: FileSpreadsheet,
                        title: "CSV / TSV",
                        description: text("legacy.ddb9ccdbccfa"),
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
              {text("legacy.ea3a2acfcb0e")}
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label>
              <span>
                <FileSpreadsheet size={18} /> {text("import.csvTsv")}
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
                placeholder={text("legacy.b4e8183d2de1")}
              />
            </label>
          </>
        ) : (
          <label className="file-drop">
            <FileUp size={34} aria-hidden="true" />
            <strong>
              {file?.name ??
                (format === "APKG"
                  ? text("legacy.8b89ccdb78b6")
                  : text("legacy.51b7097a6629"))}
            </strong>
            <span>
              {format === "APKG"
                ? text("legacy.90d84709709c")
                : text("legacy.34298bc4a18c")}
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
                {text("legacy.24abc862ee64")}: {prepared.parsed.title}
              </strong>
              {text("import.preparedSummary", [
                prepared.parsed.decks.length.toLocaleString(locale),
                prepared.parsed.decks
                  .reduce((count, deck) => count + deck.cards.length, 0)
                  .toLocaleString(locale),
                prepared.parsed.media.length.toLocaleString(locale),
                formatByteSize(prepared.file.size, locale),
                `${sourceLocale}${sourceLocale === targetLocale ? "" : ` → ${targetLocale}`}`,
              ])}
              {format === "APKG" && existingImport?.exists
                ? ` ${text("import.updatePreservesProgress")}`
                : ""}
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
                <strong>{text("legacy.6f117bfc8308")}</strong>
                <small>{text("legacy.06c22acd75d5")}</small>
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
                <small role="status">{text("legacy.57146429997d")}</small>
              ) : null}
              {existingImport?.exists ? (
                <fieldset className="anki-reimport-choice">
                  <legend>{text("legacy.a2dac560da56")}</legend>
                  <p>
                    {text("import.existingRecognized", [
                      existingImport.cardCount.toLocaleString(locale),
                    ])}
                  </p>
                  <label>
                    <input
                      type="radio"
                      name="anki-reimport-mode"
                      checked={reimportMode === "UPDATE"}
                      onChange={() => setReimportMode("UPDATE")}
                    />
                    <span>
                      <strong>{text("legacy.8da0df8b869c")}</strong>
                      <small>{text("legacy.901c24064250")}</small>
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
                      <strong>{text("legacy.46349d612f9a")}</strong>
                      <small>{text("legacy.04bf6bdd4a9c")}</small>
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
                  <strong>{text("legacy.827a736aacd6")}</strong>
                  {text("legacy.6926de62a4dd")}
                </span>
              </div>
            </div>
          </details>
        ) : null}

        {format !== "APKG" ? (
          <div className="security-info">
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>{text("legacy.827a736aacd6")}</strong>
              {text("legacy.6926de62a4dd")}
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
              {text("legacy.ae44786ffd7b")}
            </button>
          </div>
        ) : null}
        {warnings.length ? (
          <details className="import-warnings">
            <summary>
              {warnings.length} {text("legacy.ac383c176f20")}
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
          {busy ? text("legacy.3cfef309c7df") : text("legacy.be80cba37dfb")}
        </button>
        {format === "FNF" ? (
          <small className="form-hint">
            {text("legacy.a3d6bb8cf3a8", [
              file ? formatByteSize(file.size, locale) : "—",
            ])}
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
  locale: Locale;
  text: I18nText;
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
      ? text("legacy.da77a52c49f8")
      : status === "MANUAL"
        ? text("legacy.3bcdc0f6e956")
        : status === "STRUCTURAL_ADAPTER"
          ? text("legacy.bbe73e3ce8dd")
          : status === "AUTOMATIC"
            ? text("legacy.1b74f2ea14b8")
            : text("legacy.f1215cced8ec");

  return (
    <section
      className="anki-import-preview"
      aria-labelledby="anki-preview-title"
    >
      <div className="anki-preview-summary">
        <div>
          <span className="eyebrow">{text("legacy.0634bd70cbbc")}</span>
          <h2 id="anki-preview-title">{preview.collectionTitle}</h2>
        </div>
        <p>
          {preview.noteCount.toLocaleString(locale)}{" "}
          {text("legacy.3fb9cb44af69")} ·{" "}
          {preview.cardCount.toLocaleString(locale)}{" "}
          {text("legacy.69551da67e93")} ·{" "}
          {preview.deckCount.toLocaleString(locale)}{" "}
          {text("legacy.d9f26dc5bff2")}
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
              <strong>{text("legacy.d76e57f4c0b2")}</strong>
              <small>
                {preview.deckCount.toLocaleString(locale)}{" "}
                {text("legacy.d9f26dc5bff2")} ·{" "}
                {preview.cardCount.toLocaleString(locale)}{" "}
                {text("legacy.69551da67e93")}
              </small>
            </span>
            <ChevronDown aria-hidden="true" size={22} />
          </button>
        </h3>
        <p>{text("legacy.e1cde2e23421")}</p>
        <div
          className="anki-source-deck-actions anki-source-deck-actions-compact"
          role="group"
          aria-label={text("legacy.aa56b580fea0")}
        >
          <span aria-live="polite">
            {includedSourceDeckIds.length.toLocaleString(locale)} /{" "}
            {preview.sourceHierarchy.decks.length.toLocaleString(locale)}{" "}
            {text("legacy.75f8db58d5bd")}
          </span>
          <button
            type="button"
            onClick={() =>
              onIncludedSourceDeckIdsChange(
                preview.sourceHierarchy.decks.map((deck) => deck.sourceDeckId),
              )
            }
          >
            {text("legacy.efd5fd7a83ff")}
          </button>
          <button
            type="button"
            onClick={() => onIncludedSourceDeckIdsChange([])}
          >
            {text("legacy.5aed4a29190b")}
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
                    {text("legacy.b7d3737ba96c", [deck.path.join(" / ")])}
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
                      {text("legacy.69551da67e93")}
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
                            {text("legacy.c87c74f49d3e")}
                          </span>
                          <h5 id={`${panelId}-title`} aria-live="polite">
                            {text("legacy.03a27bca865b")}{" "}
                            {(safePreviewRecordIndex + 1).toLocaleString(
                              locale,
                            )}{" "}
                            {text("legacy.0a0ccf8d6e11")}{" "}
                            {previewRecords.length.toLocaleString(locale)}
                          </h5>
                          <small>
                            {previewRecord.sourceNoteTypeName ??
                              text("legacy.b2b889752af8")}
                            {" · "}
                            {previewRecord.cards.length.toLocaleString(
                              locale,
                            )}{" "}
                            {text(
                              previewRecord.cards.length === 1
                                ? "import.generatedCard"
                                : "import.generatedCards",
                            )}
                          </small>
                        </div>
                        <div
                          className="anki-live-record-navigation"
                          aria-label={text("legacy.46a344757a64")}
                        >
                          <button
                            type="button"
                            aria-label={text("legacy.01c5aa4e7174")}
                            title={text("legacy.01c5aa4e7174")}
                            disabled={safePreviewRecordIndex === 0}
                            onClick={() => setPreviewRecordIndex(0)}
                          >
                            <ChevronFirst aria-hidden="true" size={20} />
                          </button>
                          <button
                            type="button"
                            aria-label={text("legacy.a9214c0c2f8d")}
                            title={text("legacy.a9214c0c2f8d")}
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
                              {text("legacy.74a47b5d2b82")}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={previewRecords.length}
                              inputMode="numeric"
                              value={safePreviewRecordIndex + 1}
                              aria-label={text("legacy.f0365528f429")}
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
                            aria-label={text("legacy.a7db97740491")}
                            title={text("legacy.a7db97740491")}
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
                            aria-label={text("legacy.9e19a3a8d057")}
                            title={text("legacy.9e19a3a8d057")}
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
                          <strong>{text("legacy.e5f7b6f45221")}:</strong>{" "}
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
                                    text("legacy.829e75dd58fd")}
                                </strong>
                                <div className="anki-live-card-header-actions">
                                  <small>
                                    {text("legacy.21d8498cb897")}{" "}
                                    {cardIndex + 1}{" "}
                                    {text("legacy.0a0ccf8d6e11")}{" "}
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
                                    {text("legacy.88005aa25eb6")}
                                  </button>
                                </div>
                              </header>
                              <div className="anki-profile-card-preview">
                                <section>
                                  <strong>{text("legacy.880fdabd3d8c")}</strong>
                                  <AnkiImportContentPreview
                                    content={liveFront}
                                    media={previewMedia}
                                    text={text}
                                  />
                                </section>
                                <section>
                                  <strong>{text("legacy.e43418ca28af")}</strong>
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
                    <p>{text("legacy.9fd4a64d7f2e")}</p>
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
                                      {text("legacy.69551da67e93")}
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
              {text("legacy.6d25f2e55cf9")}
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
        locale={locale}
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
            <strong>{text("legacy.bc349890437c")}</strong>
            <small>{text("legacy.962c9587b623")}</small>
          </span>
        </label>
      ) : null}

      {profileSelection?.kind !== "CUSTOM" &&
      !(
        profileSelection?.kind === "BUILT_IN" &&
        profileSelection.profileId === manualAnkiFieldMappingProfileId
      ) ? (
        <p className="form-hint anki-automatic-import-note">
          {text("legacy.2d8d2e58f26f")}
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
              {text("legacy.4af2be71ce53")}: {noteType.name} (
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
                        {text("legacy.e8b76ae8f822", [field.name])}
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
                            {text(option.key)}
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
                    {text("legacy.237ccd0bb308")}
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
                  {text("legacy.face9bb033db")}
                </summary>
                <ul>
                  {noteType.omittedFields.map((field) => (
                    <li key={field.name}>
                      <strong>{field.name}</strong> ·{" "}
                      {field.distinctValueCount.toLocaleString(locale)}{" "}
                      {text("legacy.46cd2f014aa8")}
                      {field.mediaCount
                        ? ` · ${field.mediaCount.toLocaleString(locale)} ${text("legacy.39ec6f638af8")}`
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
          <h3 id="anki-warning-title">{text("legacy.d752b59a38c2")}</h3>
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
          {text("legacy.d289b22f34bc")}
          <select
            value={coverSourceName}
            onChange={(event) => onCoverSourceNameChange(event.target.value)}
          >
            <option value="">{text("legacy.c89d96413b52")}</option>
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
