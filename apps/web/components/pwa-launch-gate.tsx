"use client";

import { MonitorSmartphone, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { isInstalledAppRuntime } from "../lib/installed-app-runtime";
import { Brand } from "./brand";

type LaunchState = "checking" | "installed" | "browser";
type LaunchLanguage = "de" | "en";

export function PwaLaunchGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LaunchState>("checking");
  const [language, setLanguage] = useState<LaunchLanguage>("en");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const text = (english: string, german: string) =>
    language === "de" ? german : english;

  useEffect(() => {
    const update = () => {
      let storedLocale: string | null = null;
      try {
        storedLocale = window.localStorage.getItem("flash-n-flip.locale.v1");
      } catch {
        // The launch boundary must still render when browser storage is blocked.
      }
      setLanguage(
        storedLocale === "de" ||
          (storedLocale !== "en" && window.navigator.language.startsWith("de"))
          ? "de"
          : "en",
      );
      setState(isInstalledAppRuntime(window) ? "installed" : "browser");
    };

    update();
    window.addEventListener("pageshow", update);
    return () => {
      window.removeEventListener("pageshow", update);
    };
  }, []);

  useEffect(() => {
    if (state === "browser") headingRef.current?.focus();
  }, [state]);

  if (state === "checking") {
    return (
      <main className="auth-check" aria-busy="true">
        <span className="sr-only">
          {text("Checking application launch …", "App-Start wird geprüft …")}
        </span>
      </main>
    );
  }

  if (state === "installed") return children;

  return (
    <main className="pwa-launch-gate" aria-labelledby="pwa-launch-title">
      <section className="pwa-launch-card">
        <Brand href="/pwa" />
        <div className="pwa-launch-heading">
          <MonitorSmartphone aria-hidden="true" size={38} strokeWidth={1.8} />
          <div>
            <span className="eyebrow">
              {text("Installed app required", "Installierte App erforderlich")}
            </span>
            <h1 id="pwa-launch-title" ref={headingRef} tabIndex={-1}>
              {text(
                "Open Flash-n-Flip as an app",
                "Flash-n-Flip als App öffnen",
              )}
            </h1>
          </div>
        </div>
        <p className="pwa-launch-intro">
          {text(
            "Flash-n-Flip keeps decks, media, settings, and learning progress in the local app storage. The learning interface therefore stays closed in a normal browser tab.",
            "Flash-n-Flip speichert Lernsets, Medien, Einstellungen und Lernfortschritt im lokalen App-Speicher. Deshalb bleibt die Lernoberfläche in einem normalen Browser-Tab geschlossen.",
          )}
        </p>
        <div className="pwa-launch-instructions">
          <article>
            <Share2 aria-hidden="true" size={24} />
            <div>
              <h2>iPhone &amp; iPad</h2>
              <p>
                {text(
                  "Open Share, choose Add to Home Screen, enable Open as Web App, and add it. Then close this tab and launch Flash-n-Flip from its icon.",
                  "Öffne Teilen, wähle Zum Home-Bildschirm, aktiviere Als Web-App öffnen und füge die App hinzu. Schließe danach diesen Tab und starte Flash-n-Flip über das App-Symbol.",
                )}
              </p>
            </div>
          </article>
          <article>
            <MonitorSmartphone aria-hidden="true" size={24} />
            <div>
              <h2>Mac, Windows &amp; Android</h2>
              <p>
                {text(
                  "Use Install app in the browser menu. In Safari on Mac choose File, then Add to Dock. Launch Flash-n-Flip from the installed app afterward.",
                  "Wähle im Browser-Menü App installieren. In Safari auf dem Mac verwendest du Ablage und dann Zum Dock hinzufügen. Starte Flash-n-Flip anschließend über die installierte App.",
                )}
              </p>
            </div>
          </article>
        </div>
        <p className="pwa-launch-note">
          {text(
            "Device pairing remains available at flash-n-flip.com/connect and should be opened from the installed app when the transferred data belongs there.",
            "Die Gerätekopplung bleibt unter flash-n-flip.com/connect erreichbar und sollte aus der installierten App geöffnet werden, wenn die übertragenen Daten dort gespeichert werden sollen.",
          )}
        </p>
        <nav
          aria-label={text("Legal information", "Rechtliche Informationen")}
          className="pwa-launch-legal-links"
        >
          <Link href="/legal/imprint">{text("Imprint", "Impressum")}</Link>
          <Link href="/legal/privacy">{text("Privacy", "Datenschutz")}</Link>
          <Link href="/legal/terms">
            {text("Terms", "Nutzungsbedingungen")}
          </Link>
        </nav>
      </section>
    </main>
  );
}
