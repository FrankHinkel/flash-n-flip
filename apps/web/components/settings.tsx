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
import { getOrCreateDeviceIdentity } from "@flashcards/direct-connect-webstack/identity";
import {
  isLocale,
  supportedLocales,
  translateUiMessage,
  type Locale,
} from "@flashcards/i18n";
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
import { AudioPlayerGainSetting } from "./audio-player-gain-setting";
import { NativeStudyBadgeSetting } from "./native-study-badge-setting";
import { CloudLibrarySignInSetting } from "./cloud-library-sign-in-setting";

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
  locale: Locale;
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
    ? translateUiMessage(locale, "settings.audio.resumeCooling")
    : isBatterySuspended
      ? translateUiMessage(locale, "settings.audio.resumeBattery")
      : isEngineUnavailable
        ? translateUiMessage(locale, "settings.audio.unavailable")
        : isFinished
          ? translateUiMessage(locale, "settings.audio.complete")
          : isRunning
            ? translateUiMessage(locale, "settings.audio.pause")
            : translateUiMessage(locale, "settings.audio.start");

  return (
    <div className="audio-optimization-compact">
      <strong>{translateUiMessage(locale, "settings.audio.title")}</strong>
      <div className="audio-optimization-progress-row">
        <progress
          aria-label={translateUiMessage(locale, "settings.audio.progress")}
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
        {translateUiMessage(locale, "settings.audio.checked")} ·{" "}
        {summary.complete}{" "}
        {translateUiMessage(locale, "settings.audio.optimized")}
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
      if (isLocale(settings.locale)) {
        setLocale(settings.locale);
      }
    });
    if (isAppleCloudRuntime()) {
      void appleCloudAccountStatus()
        .then(setAppleCloudStatus)
        .catch(() => setAppleCloudStatus("UNAVAILABLE"));
    }
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
        cause instanceof Error ? cause.message : text("legacy.02539750b43c"),
      );
    } finally {
      setCloudBusy(false);
    }
  }
  async function persistLocalSettings(
    overrides: Partial<{
      locale: Locale;
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
      setMessage(text("legacy.8289966b4ad8"));
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof Error ? cause.message : text("legacy.af6ac30754ee"),
      );
    }
  }
  async function importBackup(file: File) {
    setMessage("");
    setMessageIsError(false);
    try {
      await restoreLocalProductData(file);
      window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
      setMessage(text("legacy.8027b3f158eb"));
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof Error ? cause.message : text("legacy.69395a7f8d4b"),
      );
    }
  }
  return (
    <main className="app-page settings-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("legacy.d883e710cd43")}</span>
          <h1>{text("legacy.c529245540ef")}</h1>
          <p>{text("legacy.232a1ec4d29a")}</p>
        </div>
      </header>
      <section className="settings-section">
        <h2>{text("legacy.a31308849fc0")}</h2>
        <Link className="setting-action" href="/app/help">
          <CircleHelp aria-hidden="true" />
          <span>
            <strong>{text("legacy.a31308849fc0")}</strong>
            <small>{text("legacy.a59689d34ff9")}</small>
          </span>
        </Link>
      </section>
      <section className="settings-section">
        <h2>{text("legacy.f2a30b2d89a1")}</h2>
        <NativeStudyBadgeSetting />
        <label className="setting-row">
          <div>
            <GraduationCap aria-hidden="true" />
            <span>
              <strong>{text("legacy.1e81d515ec5b")}</strong>
              <small>{text("legacy.2c41d5659170")}</small>
            </span>
          </div>
          <input
            aria-label={text("legacy.1e81d515ec5b")}
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
              setMessage(text("legacy.9d6e62169b88"));
            }}
          />
        </label>
      </section>
      <section className="settings-section">
        <h2>{text("legacy.1ddbbb5f3896")}</h2>
        <div className="setting-row">
          <div>
            <Languages />
            <span>
              <strong>{text("legacy.ac54c5177f98")}</strong>
              <small>{text("settings.availableLanguages")}</small>
            </span>
          </div>
          <select
            value={locale}
            aria-label={text("legacy.ac54c5177f98")}
            onChange={async (event) => {
              const selected = event.target.value;
              if (!isLocale(selected)) return;
              setLocale(selected);
              void persistLocalSettings({ locale: selected });
              setMessageIsError(false);
              setMessage(
                translateUiMessage(selected, "settings.languageSaved"),
              );
            }}
          >
            {supportedLocales.map((supportedLocale) => (
              <option key={supportedLocale} value={supportedLocale}>
                {
                  {
                    en: "English",
                    de: "Deutsch",
                    es: "Español",
                    fr: "Français",
                  }[supportedLocale]
                }
              </option>
            ))}
          </select>
        </div>
        <label className="setting-row setting-toggle-row">
          <div>
            <ZoomIn aria-hidden="true" />
            <span>
              <strong>{text("legacy.187566e663f4")}</strong>
              <small>{text("legacy.c6625b04d28d")}</small>
            </span>
          </div>
          <input
            className="setting-checkbox"
            type="checkbox"
            checked={pagePinchZoom}
            aria-label={text("legacy.187566e663f4")}
            onChange={(event) => {
              const enabled = event.target.checked;
              setPagePinchZoom(enabled);
              setPagePinchZoomPreference(enabled);
              void persistLocalSettings({ pagePinchZoom: enabled });
              setMessageIsError(false);
              setMessage(text("legacy.8aa4028ff555"));
            }}
          />
        </label>
        <div className="setting-row">
          <div>
            <Volume2 aria-hidden="true" />
            <span>
              <strong>{text("legacy.82c9ad0ee022")}</strong>
              <small>{text("legacy.0d963b830af6")}</small>
            </span>
          </div>
          <select
            value={textToSpeechMode}
            aria-label={text("legacy.82c9ad0ee022")}
            onChange={(event) => {
              const mode = event.target.value as TextToSpeechMode;
              setTextToSpeechMode(mode);
              setTextToSpeechPreference(mode);
              void persistLocalSettings({ textToSpeechMode: mode });
              setMessageIsError(false);
              setMessage(text("legacy.d26c25fed393"));
            }}
          >
            <option value="off">{text("legacy.0b4182aceacd")}</option>
            <option value="sentence">{text("legacy.5f72056ef329")}</option>
            <option value="sentence-and-choices">
              {text("legacy.b431deb62e68")}
            </option>
          </select>
        </div>
        <AudioPlayerGainSetting />
        <label className="setting-row setting-toggle-row">
          <div>
            <Eye aria-hidden="true" />
            <span>
              <strong>{text("legacy.464301e360ac")}</strong>
              <small>{text("legacy.d80a82c707b7")}</small>
            </span>
          </div>
          <input
            className="setting-checkbox"
            type="checkbox"
            checked={showQuestionWithAnswer}
            aria-label={text("legacy.464301e360ac")}
            onChange={(event) => {
              const visible = event.target.checked;
              setShowQuestionWithAnswer(visible);
              setStudyQuestionPreference(visible);
              void persistLocalSettings({ showQuestionWithAnswer: visible });
              setMessageIsError(false);
              setMessage(text("legacy.b31ef97f060b"));
            }}
          />
        </label>
      </section>
      <section className="settings-section">
        <h2>{text("legacy.271f8500a441")}</h2>
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
            <strong>{text("legacy.396dec5f1924")}</strong>
            <small>{text("legacy.d1fc8abc297a")}</small>
          </span>
        </button>
        <button
          className="setting-action"
          type="button"
          onClick={() => backupInputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          <span>
            <strong>{text("legacy.edd6cf376277")}</strong>
            <small>{text("legacy.bde2bc2ca809")}</small>
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
                  <strong>{text("legacy.e87dd99e94f3")}</strong>
                  <small>
                    {appleCloudStatus === "AVAILABLE"
                      ? text("legacy.320bb9ddcf9d")
                      : text("legacy.c2d32dd63dc2")}
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
                  return text("legacy.b658f72dd675");
                })
              }
            >
              <CloudUpload aria-hidden="true" />
              <span>
                <strong>{text("legacy.39eb45c66b27")}</strong>
                <small>{text("legacy.671a0e4f15b7")}</small>
              </span>
            </button>
            <button
              className="setting-action"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  const backup = await downloadAppleCloudBackup();
                  if (!backup) throw new Error(text("legacy.30f9f02f6af0"));
                  await restoreLocalProductBackupEnvelope(backup);
                  window.dispatchEvent(
                    new CustomEvent("flash-n-flip:decks-changed"),
                  );
                  return text("legacy.1d11e5d6defe");
                })
              }
            >
              <CloudDownload aria-hidden="true" />
              <span>
                <strong>{text("legacy.337298402b9f")}</strong>
                <small>{text("legacy.739241e1d39d")}</small>
              </span>
            </button>
            <button
              className="setting-action"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  const library = await createAppleFamilyLibrary(
                    text("legacy.6a64a780f046"),
                  );
                  if (library.shareUrl && navigator.share) {
                    await navigator.share({
                      title: library.title,
                      url: library.shareUrl,
                    });
                  } else if (library.shareUrl) {
                    await navigator.clipboard.writeText(library.shareUrl);
                  }
                  return text("legacy.2fdf5b2dca8c");
                })
              }
            >
              <Users aria-hidden="true" />
              <span>
                <strong>{text("legacy.2089cb2c5dd3")}</strong>
                <small>{text("legacy.25833bc8608b")}</small>
              </span>
            </button>
            <button
              className="setting-action danger"
              type="button"
              disabled={cloudBusy || appleCloudStatus !== "AVAILABLE"}
              onClick={() =>
                void runCloudAction(async () => {
                  await deleteAppleCloudBackup();
                  return text("legacy.298a26bd41ef");
                })
              }
            >
              <span>
                <strong>{text("legacy.d2dd3cc67dcb")}</strong>
                <small>{text("legacy.4423bde6aa4c")}</small>
              </span>
            </button>
          </>
        )}
        <nav
          aria-label={text("legacy.d8b1f2729b74")}
          className="settings-legal-links"
        >
          <Link href="/legal/imprint">{text("legacy.4bea4340bb51")}</Link>
          <Link href="/legal/privacy">{text("legacy.9804089865bd")}</Link>
          <Link href="/legal/terms">{text("legacy.ba9d253078dc")}</Link>
        </nav>
      </section>
      <CloudLibrarySignInSetting />
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
