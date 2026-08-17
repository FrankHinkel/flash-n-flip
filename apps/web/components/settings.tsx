"use client";

import {
  BatteryWarning,
  CircleCheck,
  CloudDownload,
  CloudUpload,
  CircleHelp,
  Download,
  Eye,
  GraduationCap,
  Languages,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Upload,
  Users,
  Volume2,
  WavesVertical,
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
import {
  audioOptimizationChangedEvent,
  audioOptimizationSummary,
  pauseLocalAudioOptimization,
  retryFailedLocalAudioOptimization,
} from "../lib/audio-optimization";
import {
  exportLocalProductData,
  exportLocalProductBackupEnvelope,
  getLocalProductSettings,
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

type AudioOptimizationCompactSummary = Pick<
  ReturnType<typeof audioOptimizationSummary>,
  | "complete"
  | "engineAvailable"
  | "failed"
  | "lastError"
  | "paused"
  | "pending"
  | "processed"
  | "running"
  | "suspensionReason"
  | "total"
>;

export function AudioOptimizationControl({
  locale,
  onToggle,
  summary,
}: {
  locale: "de" | "en";
  onToggle: () => void;
  summary: AudioOptimizationCompactSummary;
}) {
  const isRunning = !summary.paused && summary.running;
  const isThermallySuspended =
    !isRunning && !summary.paused && summary.suspensionReason === "THERMAL";
  const isBatterySuspended =
    !isRunning && !summary.paused && summary.suspensionReason === "BATTERY";
  const hasActionableJobs = summary.pending > 0 || summary.failed > 0;
  const isFinished = summary.total > 0 && !hasActionableJobs;
  const isEngineUnavailable = hasActionableJobs && !summary.engineAvailable;
  const controlLabel = isThermallySuspended
    ? locale === "de"
      ? "Audiooptimierung nach Abkühlung automatisch fortsetzen"
      : "Resume audio optimization automatically after cooling down"
    : isBatterySuspended
      ? locale === "de"
        ? "Audiooptimierung nach Ende des Batterieschutzes automatisch fortsetzen"
        : "Resume audio optimization automatically when battery protection ends"
      : isEngineUnavailable
        ? locale === "de"
          ? "Audiooptimierung ist auf diesem Gerät nicht verfügbar"
          : "Audio optimization is unavailable on this device"
        : isFinished
          ? locale === "de"
            ? "Audioprüfung abgeschlossen"
            : "Audio check complete"
          : isRunning
            ? locale === "de"
              ? "Audiooptimierung pausieren"
              : "Pause audio optimization"
            : locale === "de"
              ? "Audiooptimierung starten"
              : "Start audio optimization";

  return (
    <div className="audio-optimization-compact">
      <strong>
        {locale === "de"
          ? "Lokale Audiooptimierung"
          : "Local audio optimization"}
      </strong>
      <div className="audio-optimization-progress-row">
        <progress
          aria-label={
            locale === "de"
              ? "Fortschritt der Audiooptimierung"
              : "Audio optimization progress"
          }
          max={Math.max(1, summary.total)}
          value={summary.processed}
        />
        {isFinished ? (
          <span
            aria-label={controlLabel}
            className="audio-optimization-control"
            data-state="finished"
            role="img"
            title={controlLabel}
          >
            <CircleCheck aria-hidden="true" />
          </span>
        ) : (
          <button
            aria-label={controlLabel}
            className="audio-optimization-control"
            data-state={
              isThermallySuspended
                ? "thermal"
                : isBatterySuspended
                  ? "battery"
                  : isEngineUnavailable
                    ? "unavailable"
                    : isRunning
                      ? "running"
                      : "stopped"
            }
            disabled={isEngineUnavailable}
            onClick={onToggle}
            title={controlLabel}
            type="button"
          >
            {isThermallySuspended ? (
              <WavesVertical aria-hidden="true" />
            ) : isBatterySuspended ? (
              <BatteryWarning aria-hidden="true" />
            ) : isRunning ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <small>
        {summary.processed}/{summary.total}{" "}
        {locale === "de" ? "geprüft" : "checked"} · {summary.complete}{" "}
        {locale === "de" ? "optimiert" : "optimized"}
      </small>
      <small aria-live="polite" className="audio-optimization-last-error">
        {summary.lastError || (isEngineUnavailable ? controlLabel : "\u00a0")}
      </small>
    </div>
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
    processed: 0,
    engineAvailable: true,
    deferred: 0,
    originalBytes: 0,
    optimizedBytes: 0,
    savedBytes: 0,
    paused: false,
    running: false,
    suspensionReason: undefined as ReturnType<
      typeof audioOptimizationSummary
    >["suspensionReason"],
    lastError: undefined as string | undefined,
    current: undefined as ReturnType<
      typeof audioOptimizationSummary
    >["current"],
    contributors: [] as ReturnType<
      typeof audioOptimizationSummary
    >["contributors"],
    failedContributors: [] as ReturnType<
      typeof audioOptimizationSummary
    >["failedContributors"],
    failureReasons: [] as ReturnType<
      typeof audioOptimizationSummary
    >["failureReasons"],
    unclassifiedFailureDetails: [] as Array<[string, number]>,
    unsupportedReasons: [] as ReturnType<
      typeof audioOptimizationSummary
    >["unsupportedReasons"],
  });
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
        <AudioOptimizationControl
          locale={locale}
          summary={audioSummary}
          onToggle={() => {
            if (
              audioSummary.running &&
              !audioSummary.paused &&
              !audioSummary.suspensionReason
            ) {
              pauseLocalAudioOptimization();
              return;
            }
            void retryFailedLocalAudioOptimization();
          }}
        />
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
