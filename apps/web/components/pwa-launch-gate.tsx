"use client";

import { MonitorSmartphone, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { isInstalledAppRuntime } from "../lib/installed-app-runtime";
import { useI18n } from "./i18n-provider";

// Installation is a preference, never a condition for initializing the app.
// Keep this boundary compatible with the existing root layout.
export function PwaLaunchGate({ children }: { children: React.ReactNode }) {
  return children;
}

const installationCopy = {
  de: {
    title: "Als App installieren (optional)",
    description: "Du kannst direkt im Browser lernen. Wenn du einen eigenen App-Einstieg bevorzugst, installiere Flash-n-Flip. Die Installation ist keine Datensicherung.",
  },
  en: {
    title: "Install as an app (optional)",
    description: "You can learn directly in your browser. Install Flash-n-Flip if you prefer a separate app entry point. Installation is not a backup.",
  },
  es: {
    title: "Instalar como app (opcional)",
    description: "Puedes estudiar directamente en el navegador. Instala Flash-n-Flip si prefieres un acceso propio a la app. La instalaci\u00f3n no es una copia de seguridad.",
  },
  fr: {
    title: "Installer comme app (facultatif)",
    description: "Tu peux apprendre directement dans le navigateur. Installe Flash-n-Flip si tu pr\u00e9f\u00e8res un acc\u00e8s propre \u00e0 l'app. L'installation n'est pas une sauvegarde.",
  },
};

export function PwaInstallationSetting() {
  const { locale, text } = useI18n();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(!isInstalledAppRuntime(window));
    update();
    window.addEventListener("pageshow", update);
    window.addEventListener("appinstalled", update);
    return () => {
      window.removeEventListener("pageshow", update);
      window.removeEventListener("appinstalled", update);
    };
  }, []);

  if (!visible) return null;
  const copy = installationCopy[locale];
  return (
    <section className="settings-section">
      <details>
        <summary className="setting-action">
          <MonitorSmartphone aria-hidden="true" />
          <span><strong>{copy.title}</strong></span>
        </summary>
        <p>{copy.description}</p>
        <div className="pwa-launch-instructions">
          <article>
            <Share2 aria-hidden="true" size={24} />
            <div>
              <h2>{text("pwa.platformApple")}</h2>
              <p>{text("legacy.dd405c1543d5")}</p>
            </div>
          </article>
          <article>
            <MonitorSmartphone aria-hidden="true" size={24} />
            <div>
              <h2>{text("pwa.platformOther")}</h2>
              <p>{text("legacy.abd4940ea3fd")}</p>
            </div>
          </article>
        </div>
        <nav aria-label={text("legacy.d8b1f2729b74")} className="settings-legal-links">
          <Link href="/legal/imprint">{text("legacy.4bea4340bb51")}</Link>
          <Link href="/legal/privacy">{text("legacy.9804089865bd")}</Link>
          <Link href="/legal/terms">{text("legacy.ba9d253078dc")}</Link>
        </nav>
      </details>
    </section>
  );
}
