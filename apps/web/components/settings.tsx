"use client";

import {
  CloudDownload,
  CloudUpload,
  CircleHelp,
  Download,
  Eye,
  GraduationCap,
  Languages,
  Upload,
  Users,
  Volume2,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatAppVersion } from "@flashcards/domain/app-version";
import versionStyles from "./settings-version.module.css";

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
  exportLocalProductData,
  exportLocalProductBackupEnvelope,
  getLocalProductSettings,
  restoreLocalProductData,
  restoreLocalProductBackupEnvelope,
  patchLocalProductSettings,
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
import {
  exportLocalFile,
  LocalFileExportError,
} from "../lib/local-file-export";
import { DeviceTextSizeSetting } from "./device-text-size-setting";
import { AudioPlayerGainSetting } from "./audio-player-gain-setting";
import { MyICloudBrowser } from "./my-icloud-browser";
import { NativeStudyBadgeSetting } from "./native-study-badge-setting";

export function SettingsPanel() {
  const { locale, setLocale, text } = useI18n();
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [pagePinchZoom, setPagePinchZoom] = useState(false);
  const [textToSpeechMode, setTextToSpeechMode] = useState<TextToSpeechMode>(
    "sentence-and-choices",
  );
  const [showQuestionWithAnswer, setShowQuestionWithAnswer] = useState(true);
  const [cloudOpen, setCloudOpen] = useState(false);
  useEffect(() => {
    setCloudOpen(
      new URLSearchParams(window.location.search).get("section") === "icloud",
    );
  }, []);
  const [appleCloudStatus, setAppleCloudStatus] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const backupOperation = useRef(false);
  const editedPreferences = useRef(new Set<string>());
  const preferenceWrite = useRef(0);
  const mounted = useRef(true);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    setPagePinchZoom(getPagePinchZoomPreference());
    setTextToSpeechMode(getTextToSpeechPreference());
    setShowQuestionWithAnswer(getStudyQuestionPreference());
    void getLocalProductSettings()
      .then((settings) => {
        if (!settings || !active) return;
        if (!editedPreferences.current.has("pagePinchZoom")) {
          setPagePinchZoom(settings.pagePinchZoom);
          setPagePinchZoomPreference(settings.pagePinchZoom);
        }
        if (!editedPreferences.current.has("textToSpeechMode")) {
          setTextToSpeechMode(settings.textToSpeechMode);
          setTextToSpeechPreference(settings.textToSpeechMode);
        }
        if (!editedPreferences.current.has("showQuestionWithAnswer")) {
          setShowQuestionWithAnswer(settings.showQuestionWithAnswer);
          setStudyQuestionPreference(settings.showQuestionWithAnswer);
        }
        // The provider owns locale initialization and protects newer selections.
      })
      .catch(() => {
        if (active && !preferenceWrite.current) {
          setMessageIsError(true);
          setMessage(text("settings.loadFailed"));
        }
      });
    if (isAppleCloudRuntime()) {
      void appleCloudAccountStatus()
        .then((status) => {
          if (active) setAppleCloudStatus(status);
        })
        .catch(() => {
          if (active) setAppleCloudStatus("UNAVAILABLE");
        });
    }
    return () => {
      active = false;
      mounted.current = false;
    };
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
    for (const key of Object.keys(overrides))
      editedPreferences.current.add(key);
    const version = ++preferenceWrite.current;
    const { newCardsPerDay: dailyGoal, ...preferences } = overrides;
    try {
      await patchLocalProductSettings({
        ...preferences,
        ...(dailyGoal === undefined ? {} : { dailyGoal }),
      });
    } catch {
      if (mounted.current && preferenceWrite.current === version) {
        setMessageIsError(true);
        setMessage(text("settings.saveFailed"));
      }
    }
  }

  async function downloadExport() {
    if (backupOperation.current) return;
    backupOperation.current = true;
    setBackupBusy(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const blob = await exportLocalProductData();
      const result = await exportLocalFile(
        blob,
        "flash-n-flip-local-backup.json",
      );
      if (result !== "CANCELLED") setMessage(text("legacy.8289966b4ad8"));
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof LocalFileExportError
          ? cause.code === "FILE_TOO_LARGE"
            ? text("fileExport.tooLarge", [
                (cause.maximumBytes ?? 0) / 1024 / 1024,
              ])
            : text(
                cause.code === "NATIVE_SHARE_UNAVAILABLE"
                  ? "fileExport.nativeShareUnavailable"
                  : "fileExport.unsupported",
              )
          : cause instanceof Error
            ? cause.message
            : text("legacy.af6ac30754ee"),
      );
    } finally {
      backupOperation.current = false;
      if (mounted.current) setBackupBusy(false);
    }
  }
  async function importBackup(file: File) {
    if (backupOperation.current) return;
    backupOperation.current = true;
    setBackupBusy(true);
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
    } finally {
      backupOperation.current = false;
      if (mounted.current) setBackupBusy(false);
    }
  }
  return (
    <main className="app-page settings-page">
      <header className="app-header">
        <div>
          <h1>{text("legacy.c529245540ef")}</h1>
          <p>{text("legacy.232a1ec4d29a")}</p>
        </div>
      </header>

      <section className="settings-section">
        <h2>{text("legacy.f2a30b2d89a1")}</h2>
        <NativeStudyBadgeSetting />
        <Link className="setting-action" href="/app?strategy=1">
          <GraduationCap aria-hidden="true" />
          <span>
            <strong>{text("ui.studyPace")}</strong>
            <small>{text("ui.paceScope")}</small>
          </span>
        </Link>
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
        <h2>{text("ui.appearance")}</h2>
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
        <DeviceTextSizeSetting />
        <details className="settings-advanced">
          <summary>{text("ui.moreOptions")}</summary>
          <AudioPlayerGainSetting />
        </details>
      </section>
      <section className="settings-section">
        <h2>{text("ui.data")}</h2>
        <details
          className="settings-icloud"
          open={cloudOpen}
          onToggle={(event) => setCloudOpen(event.currentTarget.open)}
        >
          <summary>{text("ui.icloud")}</summary>
          <p>{text("ui.icloudHint")}</p>
          {cloudOpen ? <MyICloudBrowser /> : null}
        </details>
        <button
          className="setting-action"
          type="button"
          disabled={backupBusy}
          aria-busy={backupBusy}
          onClick={downloadExport}
        >
          <Download />
          <span>
            <strong>{text("ui.backup")}</strong>
            <small>
              {text(backupBusy ? "backup.processing" : "legacy.d1fc8abc297a")}
            </small>
          </span>
        </button>
        <button
          className="setting-action"
          type="button"
          disabled={backupBusy}
          aria-busy={backupBusy}
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
          hidden
          disabled={backupBusy}
          aria-label={text("legacy.edd6cf376277")}
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
          <details className="settings-advanced">
            <summary>{text("ui.moreCloudTools")}</summary>
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
          </details>
        )}
      </section>
      <section className="settings-section">
        <h2>{text("ui.help")}</h2>
        <Link className="setting-action" href="/app/help">
          <CircleHelp aria-hidden="true" />
          <span>
            <strong>{text("ui.help")}</strong>
            <small>{text("legacy.a59689d34ff9")}</small>
          </span>
        </Link>
        <nav
          aria-label={text("legacy.d8b1f2729b74")}
          className="settings-legal-links"
        >
          <Link href="/legal/imprint">{text("legacy.4bea4340bb51")}</Link>
          <Link href="/legal/privacy">{text("legacy.9804089865bd")}</Link>
          <span className={versionStyles.terms}>
            <Link href="/legal/terms">{text("legacy.ba9d253078dc")}</Link>
            {process.env.NEXT_PUBLIC_FNF_APP_VERSION && (
              <span
                className={versionStyles.version}
                aria-label={`${text("legacy.efd407326133")} ${formatAppVersion(process.env.NEXT_PUBLIC_FNF_APP_VERSION)}`}
              >
                {formatAppVersion(process.env.NEXT_PUBLIC_FNF_APP_VERSION)}
              </span>
            )}
          </span>
        </nav>
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
