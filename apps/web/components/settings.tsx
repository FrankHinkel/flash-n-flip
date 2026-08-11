"use client";

import {
  CloudDownload,
  CloudUpload,
  CircleHelp,
  Download,
  Eye,
  Languages,
  RefreshCw,
  RotateCcw,
  Upload,
  Users,
  Volume2,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  appleCloudAccountStatus,
  createAppleFamilyLibrary,
  deleteAppleCloudBackup,
  downloadAppleCloudBackup,
  isAppleCloudRuntime,
  uploadAppleCloudBackup,
} from "@flashcards/direct-connect-webstack/apple-cloud-backup";
import {
  currentWebstackActivation,
  rollbackWebstack,
  type WebstackActivation,
} from "@flashcards/direct-connect-webstack/webstack-install";
import { getOrCreateDeviceIdentity } from "@flashcards/direct-connect-webstack/identity";
import { formatByteSize } from "@flashcards/domain";
import {
  audioOptimizationChangedEvent,
  audioOptimizationJobs,
  audioOptimizationSummary,
  pauseLocalAudioOptimization,
  resumeLocalAudioOptimization,
  retryFailedLocalAudioOptimization,
} from "../lib/audio-optimization";
import {
  exportLocalProductData,
  exportLocalProductBackupEnvelope,
  getLocalProductAudioComparison,
  getLocalProductSettings,
  listLocalProductAudioComparisonCandidates,
  restoreLocalProductData,
  restoreLocalProductBackupEnvelope,
  saveLocalProductSettings,
} from "../lib/local-product-repository";
import {
  getPagePinchZoomPreference,
  setPagePinchZoomPreference,
} from "../lib/page-pinch-zoom-preference";
import {
  getTextToSpeechPreference,
  setTextToSpeechPreference,
  type TextToSpeechMode,
} from "../lib/text-to-speech-preference";
import {
  getStudyQuestionPreference,
  setStudyQuestionPreference,
} from "../lib/study-question-preference";
import { useI18n } from "./i18n-provider";
import { PwaUpdateSettings } from "./pwa-update-settings";

export type LocalAudioComparison = {
  mediaId: string;
  originalUrl: string;
  optimizedUrl: string;
  originalBytes: number;
  optimizedBytes: number;
};

export type LocalAudioComparisonCandidate = {
  mediaId: string;
  verifiedAt: string;
  durationSeconds: number;
  originalBytes: number;
  optimizedBytes: number;
};

export function selectAudioComparisonCandidates(
  candidates: readonly LocalAudioComparisonCandidate[],
): LocalAudioComparisonCandidate[] {
  const recent = [...candidates]
    .sort(
      (left, right) =>
        right.verifiedAt.localeCompare(left.verifiedAt) ||
        left.mediaId.localeCompare(right.mediaId),
    )
    .slice(0, 4);
  const longest = [...candidates]
    .sort(
      (left, right) =>
        right.durationSeconds - left.durationSeconds ||
        right.verifiedAt.localeCompare(left.verifiedAt) ||
        left.mediaId.localeCompare(right.mediaId),
    )
    .slice(0, 3);
  const greatestPercentageSaving = [...candidates]
    .sort((left, right) => {
      const leftRatio =
        (left.originalBytes - left.optimizedBytes) / left.originalBytes;
      const rightRatio =
        (right.originalBytes - right.optimizedBytes) / right.originalBytes;
      return (
        rightRatio - leftRatio ||
        right.originalBytes -
          right.optimizedBytes -
          (left.originalBytes - left.optimizedBytes) ||
        left.mediaId.localeCompare(right.mediaId)
      );
    })
    .slice(0, 3);
  const selected: LocalAudioComparisonCandidate[] = [];
  const selectedMediaIds = new Set<string>();
  for (const candidate of [
    ...recent,
    ...longest,
    ...greatestPercentageSaving,
  ]) {
    if (selectedMediaIds.has(candidate.mediaId)) continue;
    selectedMediaIds.add(candidate.mediaId);
    selected.push(candidate);
  }
  return selected;
}

const kilobytes = (bytes: number, locale: "de" | "en"): string => {
  const value = Math.max(0.1, Math.round((bytes / 1024) * 10) / 10);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} KB`;
};

export function AudioComparisonList({
  comparisons,
  locale,
}: {
  comparisons: readonly LocalAudioComparison[];
  locale: "de" | "en";
}) {
  if (!comparisons.length) return null;
  return (
    <ol className="audio-comparison-list">
      {comparisons.map((comparison, index) => {
        const titleId = `audio-comparison-${comparison.mediaId}`;
        const number = index + 1;
        return (
          <li aria-labelledby={titleId} key={comparison.mediaId}>
            <strong id={titleId}>Audio {number}</strong>
            <div>
              <span>
                Original · {kilobytes(comparison.originalBytes, locale)}
              </span>
              <audio
                aria-label={
                  locale === "en"
                    ? `Play original audio ${number}`
                    : `Originalaudio ${number} abspielen`
                }
                controls
                preload="none"
                src={comparison.originalUrl}
              />
            </div>
            <div>
              <span>
                {locale === "en" ? "Optimized" : "Optimiert"} ·{" "}
                {kilobytes(comparison.optimizedBytes, locale)}
              </span>
              <audio
                aria-label={
                  locale === "en"
                    ? `Play optimized audio ${number}`
                    : `Optimiertes Audio ${number} abspielen`
                }
                controls
                preload="none"
                src={comparison.optimizedUrl}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SettingsPanel() {
  const { locale, setLocale, text } = useI18n();
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [pagePinchZoom, setPagePinchZoom] = useState(false);
  const [textToSpeechMode, setTextToSpeechMode] = useState<TextToSpeechMode>(
    "sentence-and-choices",
  );
  const [showQuestionWithAnswer, setShowQuestionWithAnswer] = useState(true);
  const [appleCloudStatus, setAppleCloudStatus] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [peerWebstack, setPeerWebstack] = useState<WebstackActivation | null>(
    null,
  );
  const [audioSummary, setAudioSummary] = useState({
    total: 0,
    complete: 0,
    pending: 0,
    failed: 0,
    unsupported: 0,
    originalBytes: 0,
    optimizedBytes: 0,
    savedBytes: 0,
    paused: false,
    current: undefined as ReturnType<
      typeof audioOptimizationSummary
    >["current"],
    contributors: [] as Array<[string, number]>,
  });
  const [audioComparisons, setAudioComparisons] = useState<
    LocalAudioComparison[]
  >([]);
  const [audioRefreshBusy, setAudioRefreshBusy] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const refreshAudioSummary = () => {
      setAudioSummary(audioOptimizationSummary());
    };
    refreshAudioSummary();
    window.addEventListener(audioOptimizationChangedEvent, refreshAudioSummary);
    return () =>
      window.removeEventListener(
        audioOptimizationChangedEvent,
        refreshAudioSummary,
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    void (async () => {
      const completeJobs = audioOptimizationJobs().filter(
        (job) => job.status === "COMPLETE",
      );
      const candidates = selectAudioComparisonCandidates(
        await listLocalProductAudioComparisonCandidates(
          completeJobs.map((job) => job.mediaId),
        ),
      );
      const comparisons = (
        await Promise.all(
          candidates.map(async (candidate) => {
            const comparison = await getLocalProductAudioComparison(
              candidate.mediaId,
            );
            if (!comparison) return null;
            const originalUrl = URL.createObjectURL(comparison.original);
            const optimizedUrl = URL.createObjectURL(comparison.optimized);
            urls.push(originalUrl, optimizedUrl);
            return {
              mediaId: candidate.mediaId,
              originalUrl,
              optimizedUrl,
              originalBytes: comparison.original.size,
              optimizedBytes: comparison.optimized.size,
            };
          }),
        )
      ).filter((entry) => entry !== null);
      if (!cancelled) setAudioComparisons(comparisons);
    })().catch(() => {
      if (!cancelled) setAudioComparisons([]);
    });
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [audioSummary.complete]);

  const refreshAudioOptimization = async () => {
    if (audioRefreshBusy) return;
    setAudioRefreshBusy(true);
    try {
      await retryFailedLocalAudioOptimization();
    } finally {
      setAudioRefreshBusy(false);
    }
  };

  useEffect(() => {
    setPagePinchZoom(getPagePinchZoomPreference());
    setTextToSpeechMode(getTextToSpeechPreference());
    setShowQuestionWithAnswer(getStudyQuestionPreference());
    void getLocalProductSettings().then((settings) => {
      if (!settings) return;
      setPagePinchZoom(settings.pagePinchZoom);
      setPagePinchZoomPreference(settings.pagePinchZoom);
      setTextToSpeechMode(settings.textToSpeechMode);
      setTextToSpeechPreference(settings.textToSpeechMode);
      setShowQuestionWithAnswer(settings.showQuestionWithAnswer);
      setStudyQuestionPreference(settings.showQuestionWithAnswer);
      if (settings.locale === "de" || settings.locale === "en") {
        setLocale(settings.locale);
      }
    });
    if (isAppleCloudRuntime()) {
      void appleCloudAccountStatus()
        .then(setAppleCloudStatus)
        .catch(() => setAppleCloudStatus("UNAVAILABLE"));
    }
    void currentWebstackActivation()
      .then(setPeerWebstack)
      .catch(() => undefined);
  }, []);

  async function runCloudAction(action: () => Promise<string>) {
    setCloudBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      setMessage(await action());
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : text("iCloud action failed.", "iCloud-Aktion fehlgeschlagen."),
      );
    } finally {
      setCloudBusy(false);
    }
  }
  async function persistLocalSettings(
    overrides: Partial<{
      locale: "de" | "en";
      pagePinchZoom: boolean;
      textToSpeechMode: TextToSpeechMode;
      showQuestionWithAnswer: boolean;
    }> = {},
  ) {
    await saveLocalProductSettings({
      theme: "SYSTEM",
      locale: overrides.locale ?? locale,
      dailyGoal: 20,
      pagePinchZoom: overrides.pagePinchZoom ?? pagePinchZoom,
      textToSpeechMode: overrides.textToSpeechMode ?? textToSpeechMode,
      showQuestionWithAnswer:
        overrides.showQuestionWithAnswer ?? showQuestionWithAnswer,
    });
  }
  async function downloadExport() {
    setMessage("");
    setMessageIsError(false);
    try {
      const blob = await exportLocalProductData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "flash-n-flip-local-backup.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(
        text(
          "Complete local backup exported.",
          "Vollständige lokale Sicherung exportiert.",
        ),
      );
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : text("Export failed.", "Export fehlgeschlagen."),
      );
    }
  }
  async function importBackup(file: File) {
    setMessage("");
    setMessageIsError(false);
    try {
      await restoreLocalProductData(file);
      window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
      setMessage(
        text(
          "Local backup restored. Your decks are available now.",
          "Lokale Sicherung wiederhergestellt. Deine Lernsets sind jetzt verfügbar.",
        ),
      );
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : text("Import failed.", "Import fehlgeschlagen."),
      );
    }
  }
  return (
    <main className="app-page settings-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("This device", "Dieses Gerät")}</span>
          <h1>{text("Settings", "Einstellungen")}</h1>
          <p>
            {text(
              "Local data, language, appearance, and backup.",
              "Lokale Daten, Sprache, Darstellung und Sicherung.",
            )}
          </p>
        </div>
      </header>
      <section className="settings-section">
        <h2>{text("Devices", "Geräte")}</h2>
        <Link className="setting-action" href="/connect">
          <span>
            <strong>{text("Connect a device", "Gerät verbinden")}</strong>
            <small>
              {text(
                "Pair trusted devices directly without a user account",
                "Vertrauenswürdige Geräte direkt und ohne Benutzerkonto koppeln",
              )}
            </small>
          </span>
        </Link>
      </section>
      <PwaUpdateSettings />
      {peerWebstack && (
        <section className="settings-section">
          <h2>
            {text("App from trusted iPhone", "App vom vertrauten iPhone")}
          </h2>
          <div className="setting-row">
            <div>
              <CloudDownload aria-hidden="true" />
              <span>
                <strong>Flash-n-Flip {peerWebstack.appVersion}</strong>
                <small>
                  {text(
                    "Release signature and every file hash were verified before atomic activation.",
                    "Release-Signatur und jeder Datei-Hash wurden vor der atomaren Aktivierung geprüft.",
                  )}
                </small>
              </span>
            </div>
          </div>
          {peerWebstack.previousBuildId && (
            <button
              className="setting-action"
              type="button"
              onClick={() =>
                void (async () => {
                  if (await rollbackWebstack()) window.location.reload();
                })()
              }
            >
              <RotateCcw aria-hidden="true" />
              <span>
                <strong>
                  {text(
                    "Restore previous app",
                    "Vorherige App wiederherstellen",
                  )}
                </strong>
                <small>{peerWebstack.previousAppVersion}</small>
              </span>
            </button>
          )}
        </section>
      )}
      <section className="settings-section">
        <h2>{text("Help", "Hilfe")}</h2>
        <Link className="setting-action" href="/app/help">
          <CircleHelp aria-hidden="true" />
          <span>
            <strong>{text("Online help", "Online-Hilfe")}</strong>
            <small>
              {text(
                "Instructions for decks, cards, studying, maps, imports, and synchronization",
                "Anleitungen zu Lernsets, Karten, Lernen, Kartenansichten, Import und Synchronisation",
              )}
            </small>
          </span>
        </Link>
      </section>
      <section className="settings-section">
        <h2>{text("Appearance", "Darstellung")}</h2>
        <div className="setting-row">
          <div>
            <Languages />
            <span>
              <strong>{text("Interface language", "UI-Sprache")}</strong>
              <small>English / Deutsch</small>
            </span>
          </div>
          <select
            value={locale}
            aria-label={text("Interface language", "UI-Sprache")}
            onChange={async (event) => {
              const selected = event.target.value as "de" | "en";
              setLocale(selected);
              void persistLocalSettings({ locale: selected });
              setMessageIsError(false);
              setMessage(
                selected === "en"
                  ? "Language preference saved."
                  : "Spracheinstellung gespeichert.",
              );
            }}
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>
        <label className="setting-row setting-toggle-row">
          <div>
            <ZoomIn aria-hidden="true" />
            <span>
              <strong>
                {text("Website pinch zoom", "Pinch-Zoom der Website")}
              </strong>
              <small>
                {text(
                  "Allow page pinch zoom outside dedicated areas such as maps. Cmd/Ctrl with plus or minus always remains available.",
                  "Erlaubt den Pinch-Zoom der Seite außerhalb dedizierter Bereiche wie Karten. Cmd/Ctrl mit Plus oder Minus bleibt immer verfügbar.",
                )}
              </small>
            </span>
          </div>
          <input
            className="setting-checkbox"
            type="checkbox"
            checked={pagePinchZoom}
            aria-label={text("Website pinch zoom", "Pinch-Zoom der Website")}
            onChange={(event) => {
              const enabled = event.target.checked;
              setPagePinchZoom(enabled);
              setPagePinchZoomPreference(enabled);
              void persistLocalSettings({ pagePinchZoom: enabled });
              setMessageIsError(false);
              setMessage(
                text(
                  "Page zoom preference saved.",
                  "Seitenzoom-Einstellung gespeichert.",
                ),
              );
            }}
          />
        </label>
        <div className="setting-row">
          <div>
            <Volume2 aria-hidden="true" />
            <span>
              <strong>{text("Text to speech", "Vorlesefunktion")}</strong>
              <small>
                {text(
                  "Uses matching voices installed on this device. Listening to a cloze choice counts as a hint.",
                  "Nutzt passende, auf diesem Gerät installierte Stimmen. Das Anhören einer Lückenauswahl gilt als Hinweis.",
                )}
              </small>
            </span>
          </div>
          <select
            value={textToSpeechMode}
            aria-label={text("Text to speech", "Vorlesefunktion")}
            onChange={(event) => {
              const mode = event.target.value as TextToSpeechMode;
              setTextToSpeechMode(mode);
              setTextToSpeechPreference(mode);
              void persistLocalSettings({ textToSpeechMode: mode });
              setMessageIsError(false);
              setMessage(
                text(
                  "Text-to-speech preference saved.",
                  "Vorleseeinstellung gespeichert.",
                ),
              );
            }}
          >
            <option value="off">{text("Off", "Aus")}</option>
            <option value="sentence">
              {text("Sentence only", "Nur Satz")}
            </option>
            <option value="sentence-and-choices">
              {text("Sentence and cloze choices", "Satz und Lückenauswahl")}
            </option>
          </select>
        </div>
        <label className="setting-row setting-toggle-row">
          <div>
            <Eye aria-hidden="true" />
            <span>
              <strong>
                {text(
                  "Show question with answer",
                  "Frage zusammen mit Antwort zeigen",
                )}
              </strong>
              <small>
                {text(
                  "Keeps the original question visible above the revealed answer. It can also be collapsed directly on the card.",
                  "Lässt die ursprüngliche Frage oberhalb der aufgedeckten Antwort sichtbar. Sie kann zusätzlich direkt auf der Karte eingeklappt werden.",
                )}
              </small>
            </span>
          </div>
          <input
            className="setting-checkbox"
            type="checkbox"
            checked={showQuestionWithAnswer}
            aria-label={text(
              "Show question with answer",
              "Frage zusammen mit Antwort zeigen",
            )}
            onChange={(event) => {
              const visible = event.target.checked;
              setShowQuestionWithAnswer(visible);
              setStudyQuestionPreference(visible);
              void persistLocalSettings({ showQuestionWithAnswer: visible });
              setMessageIsError(false);
              setMessage(
                text(
                  "Answer display preference saved.",
                  "Anzeigeeinstellung für Antworten gespeichert.",
                ),
              );
            }}
          />
        </label>
      </section>
      <section className="settings-section">
        <h2>{text("Data & privacy", "Daten & Privatsphäre")}</h2>
        <div className="setting-row audio-optimization-row">
          <div>
            <Volume2 aria-hidden="true" />
            <span>
              <strong>
                {text("Local audio optimization", "Lokale Audiooptimierung")}
              </strong>
              <small>
                {audioSummary.total === 0
                  ? text(
                      "Imported audio is optimized only on this device or a directly connected device. The VPS is never involved.",
                      "Importiertes Audio wird ausschließlich auf diesem oder einem direkt verbundenen Gerät optimiert. Der VPS ist nie beteiligt.",
                    )
                  : text(
                      `${audioSummary.complete} of ${audioSummary.total} optimized · ${formatByteSize(audioSummary.savedBytes, locale)} potential saving after comparison · ${audioSummary.pending} pending · ${audioSummary.failed} failed`,
                      `${audioSummary.complete} von ${audioSummary.total} optimiert · ${formatByteSize(audioSummary.savedBytes, locale)} mögliche Ersparnis nach dem Vergleich · ${audioSummary.pending} offen · ${audioSummary.failed} fehlgeschlagen`,
                    )}
              </small>
            </span>
          </div>
          <button
            aria-busy={audioRefreshBusy || undefined}
            aria-label={text(
              "Refresh local audio optimization",
              "Lokale Audiooptimierung aktualisieren",
            )}
            className="audio-optimization-refresh"
            disabled={audioRefreshBusy}
            onClick={() => void refreshAudioOptimization()}
            title={text(
              "Refresh local audio optimization",
              "Lokale Audiooptimierung aktualisieren",
            )}
            type="button"
          >
            <RefreshCw aria-hidden="true" />
          </button>
        </div>
        {audioSummary.total > 0 && (
          <div aria-live="polite" className="setting-status">
            <progress
              aria-label={text(
                "Audio optimization progress",
                "Fortschritt der Audiooptimierung",
              )}
              max={audioSummary.total}
              value={audioSummary.complete}
            />
            <small>
              {audioSummary.current
                ? text(
                    `Processing on ${audioSummary.current.workerLabel ?? "local device"}: ${audioSummary.current.checkpoint}`,
                    `Verarbeitung auf ${audioSummary.current.workerLabel ?? "lokalem Gerät"}: ${audioSummary.current.checkpoint}`,
                  )
                : audioSummary.contributors.length
                  ? audioSummary.contributors
                      .map(([device, count]) => `${device}: ${count}`)
                      .join(" · ")
                  : text("Ready", "Bereit")}
              {audioSummary.unsupported > 0
                ? text(
                    ` · ${audioSummary.unsupported} unsupported`,
                    ` · ${audioSummary.unsupported} nicht unterstützt`,
                  )
                : ""}
            </small>
          </div>
        )}
        {audioComparisons.length > 0 && (
          <p className="setting-audio-comparison-note">
            {text(
              "For the listening test, up to ten verified files that differ from their original are shown: the four latest, three longest and three with the largest percentage saving. Duplicates appear once. Optimization includes noise reduction and loudness adjustment.",
              "Für den Hörtest werden bis zu zehn geprüfte Dateien angezeigt, die sich von ihrem Original unterscheiden: die vier neuesten, drei längsten und drei mit der größten prozentualen Ersparnis. Überschneidungen erscheinen nur einmal. Die Optimierung umfasst Rauschfilterung und Lautheitsanpassung.",
            )}
          </p>
        )}
        <AudioComparisonList comparisons={audioComparisons} locale={locale} />
        {audioSummary.pending > 0 && (
          <button
            className="setting-action"
            type="button"
            onClick={() => {
              if (audioSummary.paused) {
                void resumeLocalAudioOptimization();
              } else {
                pauseLocalAudioOptimization();
              }
            }}
          >
            {audioSummary.paused
              ? text("Resume audio optimization", "Audiooptimierung fortsetzen")
              : text(
                  "Pause after current audio",
                  "Nach aktuellem Audio pausieren",
                )}
          </button>
        )}
        {appleCloudStatus !== null && (
          <>
            <div className="setting-row">
              <div>
                <CloudUpload aria-hidden="true" />
                <span>
                  <strong>
                    {text(
                      "Encrypted iCloud backup",
                      "Verschlüsseltes iCloud-Backup",
                    )}
                  </strong>
                  <small>
                    {appleCloudStatus === "AVAILABLE"
                      ? text(
                          "The Apple account transports only encrypted data. The recovery key stays in iCloud Keychain.",
                          "Der Apple-Account transportiert nur verschlüsselte Daten. Der Wiederherstellungsschlüssel bleibt im iCloud-Schlüsselbund.",
                        )
                      : text(
                          "Sign in to iCloud and enable iCloud Keychain to use this backup.",
                          "Melde dich bei iCloud an und aktiviere den iCloud-Schlüsselbund, um diese Sicherung zu nutzen.",
                        )}
                  </small>
                </span>
              </div>
            </div>
            <button
              className="setting-action"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  const [backup, identity] = await Promise.all([
                    exportLocalProductBackupEnvelope(),
                    getOrCreateDeviceIdentity(),
                  ]);
                  await uploadAppleCloudBackup({
                    backup,
                    sourceDeviceId: identity.id,
                  });
                  return text(
                    "Encrypted iCloud backup updated.",
                    "Verschlüsseltes iCloud-Backup aktualisiert.",
                  );
                })
              }
            >
              <CloudUpload aria-hidden="true" />
              <span>
                <strong>{text("Back up now", "Jetzt sichern")}</strong>
                <small>
                  {text(
                    "Decks, media, settings, and progress",
                    "Lernsets, Medien, Einstellungen und Fortschritt",
                  )}
                </small>
              </span>
            </button>
            <button
              className="setting-action"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  const backup = await downloadAppleCloudBackup();
                  if (!backup)
                    throw new Error(
                      text(
                        "No iCloud backup exists.",
                        "Es ist kein iCloud-Backup vorhanden.",
                      ),
                    );
                  await restoreLocalProductBackupEnvelope(backup);
                  window.dispatchEvent(
                    new CustomEvent("flash-n-flip:decks-changed"),
                  );
                  return text(
                    "iCloud backup restored on this fresh installation.",
                    "iCloud-Backup in dieser frischen Installation wiederhergestellt.",
                  );
                })
              }
            >
              <CloudDownload aria-hidden="true" />
              <span>
                <strong>
                  {text("Restore from iCloud", "Aus iCloud wiederherstellen")}
                </strong>
                <small>
                  {text(
                    "Only possible into empty local storage",
                    "Nur in einen leeren lokalen Speicher möglich",
                  )}
                </small>
              </span>
            </button>
            <button
              className="setting-action"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  const library = await createAppleFamilyLibrary(
                    text(
                      "Flash-n-Flip family library",
                      "Flash-n-Flip-Familienbibliothek",
                    ),
                  );
                  if (library.shareUrl && navigator.share) {
                    await navigator.share({
                      title: library.title,
                      url: library.shareUrl,
                    });
                  } else if (library.shareUrl) {
                    await navigator.clipboard.writeText(library.shareUrl);
                  }
                  return text(
                    "Private family invitation prepared. Learning progress remains separate.",
                    "Private Familieneinladung vorbereitet. Lernfortschritte bleiben getrennt.",
                  );
                })
              }
            >
              <Users aria-hidden="true" />
              <span>
                <strong>
                  {text("Share family library", "Familienbibliothek teilen")}
                </strong>
                <small>
                  {text(
                    "Explicit CKShare invitation; never automatic access",
                    "Explizite CKShare-Einladung; niemals automatischer Zugriff",
                  )}
                </small>
              </span>
            </button>
            <button
              className="setting-action danger"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  await deleteAppleCloudBackup();
                  return text(
                    "iCloud backup deleted.",
                    "iCloud-Backup gelöscht.",
                  );
                })
              }
            >
              <span>
                <strong>
                  {text("Delete iCloud backup", "iCloud-Backup löschen")}
                </strong>
                <small>
                  {text(
                    "Local data remains on this device",
                    "Lokale Daten bleiben auf diesem Gerät erhalten",
                  )}
                </small>
              </span>
            </button>
          </>
        )}
        <button className="setting-action" onClick={downloadExport}>
          <Download />
          <span>
            <strong>{text("Download data", "Daten herunterladen")}</strong>
            <small>
              {text(
                "Complete local backup of decks, media, settings, and learning progress",
                "Vollständige lokale Sicherung von Lernsets, Medien, Einstellungen und Lernfortschritt",
              )}
            </small>
          </span>
        </button>
        <button
          className="setting-action"
          type="button"
          onClick={() => backupInputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          <span>
            <strong>
              {text("Restore backup", "Sicherung wiederherstellen")}
            </strong>
            <small>
              {text(
                "Restore a complete local backup on a fresh installation",
                "Vollständige lokale Sicherung in einer frischen Installation wiederherstellen",
              )}
            </small>
          </span>
        </button>
        <input
          ref={backupInputRef}
          className="sr-only"
          type="file"
          tabIndex={-1}
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void importBackup(file);
          }}
        />
      </section>
      {message && (
        <p
          className={`settings-message${messageIsError ? " error" : ""}`}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </main>
  );
}
