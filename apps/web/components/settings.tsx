"use client";

import { Download, Languages, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, browserTokenStore } from "../lib/api";
import { useI18n } from "./i18n-provider";

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
  useEffect(() => {
    api
      .me()
      .then(setProfile)
      .catch(() => {});
  }, []);
  async function downloadExport() {
    const response = await fetch(`${api.baseUrl}/auth/export`, {
      headers: {
        authorization: `Bearer ${browserTokenStore.get()?.accessToken || ""}`,
      },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flash-n-flip-data-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
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
      </section>
      <section className="settings-section">
        <h2>{text("Appearance", "Darstellung")}</h2>
        <div className="setting-row">
          <div>
            <Languages />
            <span>
              <strong>{text("Language", "Sprache")}</strong>
              <small>English / Deutsch</small>
            </span>
          </div>
          <select
            value={locale}
            aria-label={text("Language", "Sprache")}
            onChange={async (event) => {
              const selected = event.target.value as "de" | "en";
              setLocale(selected);
              const updated = await api.updateProfile({ locale: selected });
              setProfile(updated);
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
      </section>
      <section className="settings-section">
        <h2>{text("Data & privacy", "Daten & Privatsphäre")}</h2>
        <button className="setting-action" onClick={downloadExport}>
          <Download />
          <span>
            <strong>{text("Download data", "Daten herunterladen")}</strong>
            <small>
              {text(
                "JSON export of your profile, decks, and reviews",
                "JSON-Export deines Profils, deiner Lernsets und Wiederholungen",
              )}
            </small>
          </span>
        </button>
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
        <p className="settings-message" role="status">
          {message}
        </p>
      )}
    </main>
  );
}
