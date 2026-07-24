"use client";

import { Download, Languages, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "../lib/api";

export function SettingsPanel() {
  const router = useRouter();
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
        authorization: `Bearer ${JSON.parse(localStorage.getItem("flora.auth.v1") || "{}").accessToken || ""}`,
      },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flora-datenexport.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="app-page settings-page">
      <header className="app-header">
        <div>
          <span className="eyebrow">Dein Konto</span>
          <h1>Einstellungen</h1>
          <p>Privatsphäre, Sprache und Darstellung.</p>
        </div>
      </header>
      <section className="settings-section">
        <h2>Profil</h2>
        <div className="setting-row">
          <div>
            <strong>{profile?.displayName || "Lernende Person"}</strong>
            <span>{profile?.email || "Profil wird geladen …"}</span>
          </div>
        </div>
      </section>
      <section className="settings-section">
        <h2>Darstellung</h2>
        <div className="setting-row">
          <div>
            <Languages />
            <span>
              <strong>Sprache</strong>
              <small>Deutsch / English</small>
            </span>
          </div>
          <select
            value={profile?.locale || "de"}
            aria-label="Sprache"
            onChange={async (event) => {
              const locale = event.target.value as "de" | "en";
              const updated = await api.updateProfile({ locale });
              setProfile(updated);
              setMessage(
                locale === "en"
                  ? "Language preference saved."
                  : "Spracheinstellung gespeichert.",
              );
            }}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>
      <section className="settings-section">
        <h2>Daten & Privatsphäre</h2>
        <button className="setting-action" onClick={downloadExport}>
          <Download />
          <span>
            <strong>Daten herunterladen</strong>
            <small>
              JSON-Export deines Profils, deiner Lernsets und Wiederholungen
            </small>
          </span>
        </button>
        <button
          className="setting-action danger"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 />
          <span>
            <strong>Konto löschen</strong>
            <small>
              Nach Bestätigung werden dein Konto und private Daten gelöscht.
            </small>
          </span>
        </button>
        {confirmDelete && (
          <div className="delete-confirmation">
            <strong>Konto endgültig löschen?</strong>
            <p>
              Private Lernsets und Lernfortschritt werden gelöscht. Bereits
              veröffentlichte Inhalte bleiben anonymisiert erhalten.
            </p>
            <label>
              Tippe LÖSCHEN zur Bestätigung
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
                Abbrechen
              </button>
              <button
                className="button danger"
                disabled={deleteText !== "LÖSCHEN"}
                onClick={async () => {
                  await api.deleteAccount();
                  router.replace("/");
                }}
              >
                Unwiderruflich löschen
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
