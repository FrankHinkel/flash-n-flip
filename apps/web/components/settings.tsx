"use client";

import {
  CircleHelp,
  Download,
  Eye,
  Languages,
  Upload,
  Volume2,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  exportLocalProductData,
  getLocalProductSettings,
  restoreLocalProductData,
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

export function SettingsPanel() {
  const { locale, setLocale, text } = useI18n();
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [pagePinchZoom, setPagePinchZoom] = useState(false);
  const [textToSpeechMode, setTextToSpeechMode] = useState<TextToSpeechMode>(
    "sentence-and-choices",
  );
  const [showQuestionWithAnswer, setShowQuestionWithAnswer] = useState(true);
  const backupInputRef = useRef<HTMLInputElement>(null);
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
  }, []);
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
