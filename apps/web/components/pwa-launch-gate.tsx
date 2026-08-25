"use client";

import { MonitorSmartphone, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  defaultLocale,
  isLocale,
  translateUiMessage,
  type Locale,
  type UiMessageKey,
  type UiMessageValue,
} from "@flashcards/i18n";

import { isInstalledAppRuntime } from "../lib/installed-app-runtime";
import { Brand } from "./brand";

type LaunchState = "checking" | "installed" | "browser";

export function PwaLaunchGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LaunchState>("checking");
  const [language, setLanguage] = useState<Locale>(defaultLocale);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const text = (key: UiMessageKey, values?: readonly UiMessageValue[]) =>
    translateUiMessage(language, key, values);

  useEffect(() => {
    const update = () => {
      let storedLocale: string | null = null;
      try {
        storedLocale = window.localStorage.getItem("flash-n-flip.locale.v1");
      } catch {
        // The launch boundary must still render when browser storage is blocked.
      }
      const browserLocale = window.navigator.language.slice(0, 2);
      setLanguage(
        isLocale(storedLocale)
          ? storedLocale
          : isLocale(browserLocale)
            ? browserLocale
            : defaultLocale,
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
        <span className="sr-only">{text("legacy.7b5fdd4e7733")}</span>
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
            <span className="eyebrow">{text("legacy.c15e7b79b4ae")}</span>
            <h1 id="pwa-launch-title" ref={headingRef} tabIndex={-1}>
              {text("legacy.4cad1148a191")}
            </h1>
          </div>
        </div>
        <p className="pwa-launch-intro">{text("legacy.a1a83f105bd2")}</p>
        <div className="pwa-launch-instructions">
          <article>
            <Share2 aria-hidden="true" size={24} />
            <div>
              <h2>iPhone &amp; iPad</h2>
              <p>{text("legacy.dd405c1543d5")}</p>
            </div>
          </article>
          <article>
            <MonitorSmartphone aria-hidden="true" size={24} />
            <div>
              <h2>Mac, Windows &amp; Android</h2>
              <p>{text("legacy.abd4940ea3fd")}</p>
            </div>
          </article>
        </div>
        <p className="pwa-launch-note">{text("legacy.02ab17489c4b")}</p>
        <nav
          aria-label={text("legacy.d8b1f2729b74")}
          className="pwa-launch-legal-links"
        >
          <Link href="/legal/imprint">{text("legacy.4bea4340bb51")}</Link>
          <Link href="/legal/privacy">{text("legacy.9804089865bd")}</Link>
          <Link href="/legal/terms">{text("legacy.ba9d253078dc")}</Link>
        </nav>
      </section>
    </main>
  );
}
