"use client";

import {
  CloudDownload,
  CloudUpload,
  CircleHelp,
  Download,
  Eye,
  GraduationCap,
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
import {
  directSyncRuntimeChangedEvent,
  getDirectSyncRuntime,
  type DirectSyncSnapshot,
} from "@flashcards/direct-connect-webstack/reconnect-runtime";
import { formatByteSize } from "@flashcards/domain";
import {
  audioOptimizationChangedEvent,
  audioOptimizationJobs,
  audioOptimizationSummary,
  pauseLocalAudioOptimization,
  resumeLocalAudioOptimization,
  retryFailedLocalAudioOptimization,
  type AudioOptimizationIssueKind,
  type AudioOptimizationWorkerKind,
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

const audioWorkerLabel = (
  kind: AudioOptimizationWorkerKind,
  locale: "de" | "en",
): string => {
  if (kind === "APPLE_NATIVE")
    return locale === "de"
      ? "Apple-Gerät (AVFoundation)"
      : "Apple device (AVFoundation)";
  if (kind === "BROWSER") return "Browser/PC (ffmpeg.wasm)";
  return locale === "de" ? "Andere Engine" : "Other engine";
};

const audioIssueLabel = (
  kind: AudioOptimizationIssueKind,
  locale: "de" | "en",
): string => {
  const labels: Record<AudioOptimizationIssueKind, [string, string]> = {
    DEVICE_PROTECTION: [
      "Deferred for battery or temperature protection",
      "Wegen Akku- oder Temperaturschutz aufgeschoben",
    ],
    EMPTY: ["Empty audio", "Leeres Audio"],
    SIZE_LIMIT: ["Larger than 16 MiB", "Größer als 16 MiB"],
    DURATION_LIMIT: ["Longer than 30 minutes", "Länger als 30 Minuten"],
    FORMAT_OR_DECODE: [
      "Format cannot be decoded or has no audio track",
      "Format nicht decodierbar oder ohne Audiospur",
    ],
    TOO_SHORT_OR_SILENT: [
      "Too short or silent for loudness analysis",
      "Zu kurz oder still für die Lautheitsanalyse",
    ],
    ANALYSIS: ["Loudness analysis", "Lautheitsanalyse"],
    ENCODING: [
      "Encoding or output validation",
      "Kodierung oder Ausgabeprüfung",
    ],
    STORAGE: [
      "Local storage or missing source",
      "Lokaler Speicher oder fehlende Quelle",
    ],
    ENGINE_UNAVAILABLE: [
      "Optimization engine unavailable",
      "Optimierungs-Engine nicht verfügbar",
    ],
    UNKNOWN: ["Unclassified error", "Noch nicht klassifizierter Fehler"],
  };
  return labels[kind][locale === "de" ? 1 : 0];
};

export function AudioOptimizationIssueBreakdown({
  deferred,
  failureReasons,
  locale,
  unclassifiedFailureDetails,
  unsupportedReasons,
}: {
  deferred: number;
  failureReasons: ReadonlyArray<[AudioOptimizationIssueKind, number]>;
  locale: "de" | "en";
  unclassifiedFailureDetails: ReadonlyArray<[string, number]>;
  unsupportedReasons: ReadonlyArray<[AudioOptimizationIssueKind, number]>;
}) {
  if (
    !deferred &&
    !failureReasons.length &&
    !unclassifiedFailureDetails.length &&
    !unsupportedReasons.length
  ) {
    return null;
  }
  const text = (english: string, german: string) =>
    locale === "de" ? german : english;
  return (
    <div
      aria-label={text(
        "Audio optimization issue analysis",
        "Fehleranalyse der Audiooptimierung",
      )}
      className="audio-issue-breakdown"
    >
      {deferred > 0 && (
        <p>
          {text(
            `${deferred} audio files are waiting because the Apple device is protecting its battery or temperature. Connect power and start optimization again; they do not count as failed.`,
            `${deferred} Audios warten zum Schutz von Akku und Gerätetemperatur. Strom anschließen und die Optimierung erneut starten; sie zählen nicht als fehlgeschlagen.`,
          )}
        </p>
      )}
      {failureReasons.length > 0 && (
        <div>
          <strong>{text("Failure reasons", "Fehlerursachen")}</strong>
          <ul>
            {failureReasons.map(([kind, count]) => (
              <li key={kind}>
                <span>{audioIssueLabel(kind, locale)}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {unclassifiedFailureDetails.length > 0 && (
        <div>
          <strong>
            {text(
              "Details for unclassified errors",
              "Details zu nicht klassifizierten Fehlern",
            )}
          </strong>
          <ul>
            {unclassifiedFailureDetails.map(([message, count]) => (
              <li key={message}>
                <span>{message}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
          <small>
            {text(
              "Older Apple builds stored only a generic message. Refresh retries these files; the new build then records the actual cause.",
              "Ältere Apple-Builds speicherten nur eine allgemeine Meldung. Aktualisieren versucht diese Dateien erneut; der neue Build erfasst danach die tatsächliche Ursache.",
            )}
          </small>
        </div>
      )}
      {unsupportedReasons.length > 0 && (
        <div>
          <strong>{text("Not optimizable", "Nicht optimierbar")}</strong>
          <ul>
            {unsupportedReasons.map(([kind, count]) => (
              <li key={kind}>
                <span>{audioIssueLabel(kind, locale)}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
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
  const [newCardsPerDay, setNewCardsPerDay] = useState(10);
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
    keptOriginal: 0,
    deferred: 0,
    originalBytes: 0,
    optimizedBytes: 0,
    savedBytes: 0,
    paused: false,
    current: undefined as ReturnType<
      typeof audioOptimizationSummary
    >["current"],
    contributors: [] as Array<[AudioOptimizationWorkerKind, number]>,
    failedContributors: [] as Array<[AudioOptimizationWorkerKind, number]>,
    failureReasons: [] as Array<[AudioOptimizationIssueKind, number]>,
    unclassifiedFailureDetails: [] as Array<[string, number]>,
    unsupportedReasons: [] as Array<[AudioOptimizationIssueKind, number]>,
  });
  const [audioComparisons, setAudioComparisons] = useState<
    LocalAudioComparison[]
  >([]);
  const [audioRefreshBusy, setAudioRefreshBusy] = useState(false);
  const [directSync, setDirectSync] = useState<DirectSyncSnapshot>({
    mode: "automatic",
    state: "disconnected",
    reconnecting: false,
    trustedPeerCount: 0,
    pendingCount: 0,
    lastSyncedAt: null,
    message: "",
  });
  const [directSyncBusy, setDirectSyncBusy] = useState(false);
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
    const runtime = getDirectSyncRuntime();
    const refresh = () => setDirectSync(runtime.snapshot());
    window.addEventListener(directSyncRuntimeChangedEvent, refresh);
    void runtime
      .initialize()
      .then(refresh)
      .catch(() => refresh());
    return () =>
      window.removeEventListener(directSyncRuntimeChangedEvent, refresh);
  }, []);

  const synchronizeTrustedDevice = async () => {
    if (directSyncBusy) return;
    setDirectSyncBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      await getDirectSyncRuntime().syncNow();
      setMessage(
        text(
          "Synchronization with the trusted device completed.",
          "Abgleich mit dem vertrauenswürdigen Gerät abgeschlossen.",
        ),
      );
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : text("Synchronization failed.", "Abgleich fehlgeschlagen."),
      );
    } finally {
      setDirectSyncBusy(false);
    }
  };

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
      setNewCardsPerDay(settings.dailyGoal);
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
      newCardsPerDay: number;
    }> = {},
  ) {
    await saveLocalProductSettings({
      theme: "SYSTEM",
      locale: overrides.locale ?? locale,
      dailyGoal: overrides.newCardsPerDay ?? newCardsPerDay,
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
        <div className="setting-row">
          <div>
            <RefreshCw aria-hidden="true" />
            <span>
              <strong>{text("Device sync", "Geräteabgleich")}</strong>
              <small>
                {text(
                  "Automatic keeps trusted active devices in sync; manual uses rendezvous signaling only when you press the button.",
                  "Automatisch hält aktive vertraute Geräte synchron; manuell nutzt die Rendezvous-Vermittlung nur nach Knopfdruck.",
                )}
              </small>
            </span>
          </div>
          <select
            aria-label={text("Device sync mode", "Modus des Geräteabgleichs")}
            value={directSync.mode}
            onChange={(event) => {
              const mode = event.target.value as "automatic" | "manual";
              getDirectSyncRuntime().setMode(mode);
              setDirectSync(getDirectSyncRuntime().snapshot());
              setMessageIsError(false);
              setMessage(
                mode === "automatic"
                  ? text(
                      "Automatic reconnect enabled.",
                      "Automatische Wiederverbindung aktiviert.",
                    )
                  : text(
                      "Synchronization now runs only on request.",
                      "Der Abgleich läuft jetzt nur noch auf Anforderung.",
                    ),
              );
            }}
          >
            <option value="automatic">
              {text("Automatic", "Automatisch")}
            </option>
            <option value="manual">
              {text("On request", "Auf Knopfdruck")}
            </option>
          </select>
        </div>
        <button
          aria-busy={directSyncBusy || directSync.reconnecting || undefined}
          className="setting-action"
          disabled={
            directSyncBusy ||
            directSync.reconnecting ||
            directSync.trustedPeerCount === 0
          }
          onClick={() => void synchronizeTrustedDevice()}
          type="button"
        >
          <RefreshCw aria-hidden="true" />
          <span>
            <strong>{text("Sync now", "Jetzt synchronisieren")}</strong>
            <small aria-live="polite">
              {directSync.trustedPeerCount === 0
                ? text(
                    "Pair a trusted device once using its QR code",
                    "Zuerst einmalig ein vertrauenswürdiges Gerät per QR-Code koppeln",
                  )
                : `${directSync.message} · ${directSync.pendingCount} ${text(
                    "pending",
                    "offen",
                  )}${
                    directSync.lastSyncedAt
                      ? ` · ${text("Last sync", "Letzter Abgleich")}: ${new Intl.DateTimeFormat(
                          locale,
                          { dateStyle: "short", timeStyle: "short" },
                        ).format(new Date(directSync.lastSyncedAt))}`
                      : ""
                  }`}
            </small>
          </span>
        </button>
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
        <h2>{text("Learning", "Lernen")}</h2>
        <label className="setting-row">
          <div>
            <GraduationCap aria-hidden="true" />
            <span>
              <strong>
                {text("New cards per day", "Neue Karten pro Tag")}
              </strong>
              <small>
                {text(
                  "Limits new cards from your learning plan. Due reviews are never hidden by this limit.",
                  "Begrenzt neue Karten aus deinem Lernplan. Fällige Wiederholungen werden durch dieses Limit niemals ausgeblendet.",
                )}
              </small>
            </span>
          </div>
          <input
            aria-label={text("New cards per day", "Neue Karten pro Tag")}
            inputMode="numeric"
            min={1}
            max={1000}
            type="number"
            value={newCardsPerDay}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(parsed)) {
                setNewCardsPerDay(Math.min(1000, Math.max(1, parsed)));
              }
            }}
            onBlur={() => {
              void persistLocalSettings({ newCardsPerDay });
              setMessageIsError(false);
              setMessage(
                text(
                  "Daily new-card limit saved.",
                  "Tageslimit für neue Karten gespeichert.",
                ),
              );
            }}
          />
        </label>
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
                      `${audioSummary.complete} of ${audioSummary.total} optimized · ${formatByteSize(audioSummary.savedBytes, locale)} potential saving after comparison · ${audioSummary.pending} pending · ${audioSummary.keptOriginal} kept unchanged · ${audioSummary.unsupported} not optimizable · ${audioSummary.failed} failed`,
                      `${audioSummary.complete} von ${audioSummary.total} optimiert · ${formatByteSize(audioSummary.savedBytes, locale)} mögliche Ersparnis nach dem Vergleich · ${audioSummary.pending} offen · ${audioSummary.keptOriginal} unverändert · ${audioSummary.unsupported} nicht optimierbar · ${audioSummary.failed} fehlgeschlagen`,
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
                  ? `${text("Successfully optimized", "Erfolgreich optimiert")}: ${audioSummary.contributors
                      .map(
                        ([kind, count]) =>
                          `${audioWorkerLabel(kind, locale)}: ${count}`,
                      )
                      .join(" · ")}`
                  : text("Ready", "Bereit")}
              {audioSummary.failedContributors.length
                ? ` · ${text("Failed", "Fehlgeschlagen")}: ${audioSummary.failedContributors
                    .map(
                      ([kind, count]) =>
                        `${audioWorkerLabel(kind, locale)}: ${count}`,
                    )
                    .join(" · ")}`
                : ""}
              {audioSummary.unsupported > 0
                ? text(
                    ` · ${audioSummary.unsupported} unsupported`,
                    ` · ${audioSummary.unsupported} nicht unterstützt`,
                  )
                : ""}
            </small>
          </div>
        )}
        <AudioOptimizationIssueBreakdown
          deferred={audioSummary.deferred}
          failureReasons={audioSummary.failureReasons}
          locale={locale}
          unclassifiedFailureDetails={audioSummary.unclassifiedFailureDetails}
          unsupportedReasons={audioSummary.unsupportedReasons}
        />
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
              if (audioSummary.paused || audioSummary.deferred > 0) {
                void resumeLocalAudioOptimization();
              } else {
                pauseLocalAudioOptimization();
              }
            }}
          >
            {audioSummary.paused || audioSummary.deferred > 0
              ? text(
                  "Start audio optimization while charging",
                  "Audiooptimierung am Strom starten",
                )
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
