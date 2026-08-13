"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { formatAppBuildTime } from "../lib/app-build";
import { useI18n } from "./i18n-provider";
import { usePwaUpdate } from "./pwa-update-provider";

export function PwaUpdateSettings() {
  const { locale, text } = useI18n();
  const { applyUpdate, checkForUpdate, phase, reloadRequired, supported } =
    usePwaUpdate();
  const buildTime = process.env.NEXT_PUBLIC_FNF_WEB_BUILD_TIME ?? "";
  const version = process.env.NEXT_PUBLIC_FNF_APP_VERSION ?? "";
  const [localizedBuildTime, setLocalizedBuildTime] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setLocalizedBuildTime(formatAppBuildTime(buildTime, locale));
  }, [buildTime, locale]);

  if (!supported) return null;

  const updateAvailable = phase === "available";
  const busy = phase === "checking" || phase === "applying";
  const title =
    phase === "available"
      ? text("Update available", "Aktualisierung verfügbar")
      : phase === "checking"
        ? text("Checking for updates …", "Aktualisierungen werden geprüft …")
        : phase === "applying"
          ? text("Installing update …", "Aktualisierung wird installiert …")
          : phase === "error"
            ? text(
                "Update check failed",
                "Aktualisierungsprüfung fehlgeschlagen",
              )
            : text("Web app updates", "Web-App-Aktualisierungen");
  const description =
    phase === "available"
      ? reloadRequired
        ? text(
            "The new version is ready and will be loaded after confirmation.",
            "Die neue Version ist bereit und wird nach Bestätigung geladen.",
          )
        : text(
            "Your local decks and learning progress remain untouched.",
            "Deine lokalen Lernsets und dein Lernfortschritt bleiben unangetastet.",
          )
      : phase === "current"
        ? text(
            "The installed Web app is up to date.",
            "Die installierte Web-App ist aktuell.",
          )
        : phase === "error"
          ? text(
              "Check your connection and try again.",
              "Prüfe deine Verbindung und versuche es erneut.",
            )
          : text(
              "Updates are checked and downloaded automatically at startup, periodically, and when the Web app returns to the foreground. Activation still requires confirmation.",
              "Aktualisierungen werden beim Start, regelmäßig und beim Wechsel in den Vordergrund automatisch gesucht und heruntergeladen. Die Aktivierung braucht weiterhin deine Bestätigung.",
            );

  return (
    <section className="settings-section pwa-update-settings">
      <h2>{text("Application update", "App-Aktualisierung")}</h2>
      <div className="setting-row">
        <div>
          <RefreshCw aria-hidden="true" />
          <div className="pwa-update-settings-copy">
            <span aria-live="polite">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            {(version || localizedBuildTime) && (
              <small className="pwa-update-build">
                {version && (
                  <>
                    {text("Version", "Version")} {version}
                  </>
                )}
                {version && localizedBuildTime && " · "}
                {localizedBuildTime && (
                  <>
                    {text("Build", "Build")}:{" "}
                    <time dateTime={buildTime}>{localizedBuildTime}</time>
                  </>
                )}
              </small>
            )}
          </div>
        </div>
        <button
          className="button button-quiet pwa-update-settings-button"
          disabled={busy}
          onClick={() =>
            void (updateAvailable ? applyUpdate() : checkForUpdate())
          }
        >
          {phase === "checking"
            ? text("Checking …", "Prüft …")
            : phase === "applying"
              ? text("Installing …", "Installiert …")
              : updateAvailable
                ? text("Update now", "Jetzt aktualisieren")
                : text("Check for update", "Auf Aktualisierung prüfen")}
        </button>
      </div>
    </section>
  );
}
