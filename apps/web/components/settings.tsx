"use client";

import {
  CircleHelp,
  Download,
  Eye,
  Languages,
  LogOut,
  Upload,
  Trash2,
  Volume2,
  ZoomIn,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import {
  exportLocalProductData,
  getLocalProductSettings,
  restoreLocalProductData,
  saveLocalProductSettings,
} from "../lib/local-product-repository";
import {
  cacheProfile,
  clearOfflineData,
  flushReviews,
  getCachedProfile,
  queuedReviews,
} from "../lib/offline";
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
import { DeviceSyncSettings } from "./device-sync-settings";
import { PwaUpdateSettings } from "./pwa-update-settings";
import { PasswordSecuritySettings } from "./password-security-settings";
import { QrScannerButton } from "./universal-qr-scanner";

export function SettingsPanel() {
  const router = useRouter();
  const { locale, setLocale, text } = useI18n();
  const [profile, setProfile] = useState<{
    displayName: string;
    email: string;
    locale: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
    void getCachedProfile()
      .then(setProfile)
      .catch(() => {});
    void api
      .me()
      .then((value) => {
        setProfile(value);
        void cacheProfile(value).catch(() => {});
      })
      .catch(() => {});
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
  async function logout() {
    setLoggingOut(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const pending = await queuedReviews();
      if (pending.length) {
        try {
          await flushReviews((review) => api.review(review));
        } catch {
          const confirmed = window.confirm(
            text(
              `${pending.length} unsynchronized ${
                pending.length === 1 ? "review" : "reviews"
              } will be deleted from this device when you sign out. Sign out anyway?`,
              `${pending.length} noch nicht synchronisierte ${
                pending.length === 1
                  ? "Wiederholung wird"
                  : "Wiederholungen werden"
              } beim Abmelden von diesem Gerät gelöscht. Trotzdem abmelden?`,
            ),
          );
          if (!confirmed) {
            setMessage(
              text(
                "Sign-out cancelled. Synchronize your reviews and try again.",
                "Abmelden abgebrochen. Synchronisiere die Wiederholungen und versuche es erneut.",
              ),
            );
            return;
          }
        }
      }
      await clearOfflineData();
      await api.logout();
      router.replace("/login");
    } catch {
      setMessageIsError(true);
      setMessage(
        text(
          "Sign-out failed. Local data could not be removed safely.",
          "Abmelden fehlgeschlagen. Die lokalen Daten konnten nicht sicher entfernt werden.",
        ),
      );
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <main className="app-page settings-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">{text("Your account", "Dein Konto")}</span>
          <h1>{text("Settings", "Einstellungen")}</h1>
          <p>
            {text(
              "Privacy, language, and appearance.",
              "Privatsphäre, Sprache und Darstellung.",
            )}
          </p>
        </div>
      </header>
      <section className="settings-section">
        <h2>{text("Profile", "Profil")}</h2>
        <div className="setting-row">
          <div>
            <strong>
              {profile?.displayName || text("Learner", "Lernende Person")}
            </strong>
            <span>
              {profile?.email ||
                text("Loading profile …", "Profil wird geladen …")}
            </span>
          </div>
        </div>
        <button
          className="setting-action"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          <LogOut />
          <span>
            <strong>
              {loggingOut
                ? text("Signing out …", "Wird abgemeldet …")
                : text("Sign out", "Abmelden")}
            </strong>
            <small>
              {text(
                "End this session and remove local account data",
                "Sitzung beenden und lokale Kontodaten entfernen",
              )}
            </small>
          </span>
        </button>
      </section>
      <PasswordSecuritySettings />
      <DeviceSyncSettings />
      <section className="settings-section qr-scanner-settings">
        <h2>{text("QR codes", "QR-Codes")}</h2>
        <QrScannerButton className="setting-action">
          <span>
            <strong>{text("Scan QR code", "QR-Code scannen")}</strong>
            <small>
              {text(
                "Receive shared decks and open Flash-n-Flip invitations.",
                "Geteilte Lernsets empfangen und Flash-n-Flip-Einladungen öffnen.",
              )}
            </small>
          </span>
        </QrScannerButton>
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
              setProfile((current) =>
                current ? { ...current, locale: selected } : current,
              );
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
        <button
          className="setting-action danger"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 />
          <span>
            <strong>{text("Delete account", "Konto löschen")}</strong>
            <small>
              {text(
                "After confirmation, your account and private data are deleted.",
                "Nach Bestätigung werden dein Konto und private Daten gelöscht.",
              )}
            </small>
          </span>
        </button>
        {confirmDelete && (
          <div className="delete-confirmation">
            <strong>
              {text("Permanently delete account?", "Konto endgültig löschen?")}
            </strong>
            <p>
              {text(
                "Private decks and learning progress are deleted. Previously published content remains anonymized.",
                "Private Lernsets und Lernfortschritt werden gelöscht. Bereits veröffentlichte Inhalte bleiben anonymisiert erhalten.",
              )}
            </p>
            <label>
              {text("Type DELETE to confirm", "Tippe LÖSCHEN zur Bestätigung")}
              <input
                value={deleteText}
                onChange={(event) => setDeleteText(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div>
              <button
                className="button button-quiet"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteText("");
                }}
              >
                {text("Cancel", "Abbrechen")}
              </button>
              <button
                className="button danger"
                disabled={
                  deleteText !== (locale === "de" ? "LÖSCHEN" : "DELETE")
                }
                onClick={async () => {
                  await api.deleteAccount();
                  router.replace("/");
                }}
              >
                {text("Delete permanently", "Unwiderruflich löschen")}
              </button>
            </div>
          </div>
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
