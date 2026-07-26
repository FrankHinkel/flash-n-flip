"use client";

import {
  Check,
  ChevronDown,
  Languages,
  Moon,
  Sun,
  SunMoon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "./i18n-provider";

type ThemePreference = "dark" | "auto" | "bright";
type Popup = "language" | "theme" | null;

const themeKey = "flash-n-flip.theme.v1";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "dark" || value === "auto" || value === "bright";
}

function resolvedTheme(preference: ThemePreference): "dark" | "bright" {
  return preference === "auto"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "bright"
    : preference;
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = preference;
  root.dataset.resolvedTheme = resolvedTheme(preference);
}

export function LanguageSwitcher() {
  const { locale, setLocale, text } = useI18n();
  const root = useRef<HTMLDivElement>(null);
  const languageTrigger = useRef<HTMLButtonElement>(null);
  const themeTrigger = useRef<HTMLButtonElement>(null);
  const [popup, setPopup] = useState<Popup>(null);
  const [theme, setTheme] = useState<ThemePreference>("auto");

  useEffect(() => {
    const stored = localStorage.getItem(themeKey);
    const next = isThemePreference(stored) ? stored : "auto";
    setTheme(next);
    applyTheme(next);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = () => {
      if ((localStorage.getItem(themeKey) ?? "auto") === "auto") {
        applyTheme("auto");
      }
    };
    media.addEventListener("change", handleSystemTheme);
    return () => media.removeEventListener("change", handleSystemTheme);
  }, []);

  useEffect(() => {
    if (!popup) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const trigger =
        popup === "language" ? languageTrigger.current : themeTrigger.current;
      setPopup(null);
      requestAnimationFrame(() => trigger?.focus());
    };
    const handlePointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPopup(null);
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("pointerdown", handlePointer);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("pointerdown", handlePointer);
    };
  }, [popup]);

  function closeTo(trigger: HTMLButtonElement | null) {
    setPopup(null);
    requestAnimationFrame(() => trigger?.focus());
  }

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    localStorage.setItem(themeKey, next);
    applyTheme(next);
    closeTo(themeTrigger.current);
  }

  const themes = [
    {
      value: "dark" as const,
      label: text("Dark", "Dunkel"),
      icon: Moon,
    },
    {
      value: "auto" as const,
      label: text("Auto", "Automatisch"),
      icon: SunMoon,
    },
    {
      value: "bright" as const,
      label: text("Bright", "Hell"),
      icon: Sun,
    },
  ];
  const selectedTheme = themes.find((item) => item.value === theme) ?? {
    value: "auto" as const,
    label: text("Auto", "Automatisch"),
    icon: SunMoon,
  };
  const ThemeIcon = selectedTheme.icon;

  return (
    <div
      className="preference-switchers"
      aria-label={text("Language and appearance", "Sprache und Darstellung")}
      ref={root}
    >
      <div className="preference-popup">
        <button
          aria-expanded={popup === "language"}
          aria-haspopup="menu"
          aria-label={text(
            `Language: ${locale.toUpperCase()}`,
            `Sprache: ${locale.toUpperCase()}`,
          )}
          className="preference-trigger"
          onClick={() =>
            setPopup((current) => (current === "language" ? null : "language"))
          }
          ref={languageTrigger}
          type="button"
        >
          <Languages size={18} aria-hidden="true" />
          <span>{locale.toUpperCase()}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        {popup === "language" && (
          <div
            className="preference-menu"
            role="menu"
            aria-label={text("Choose language", "Sprache wählen")}
          >
            {(["en", "de"] as const).map((item) => (
              <button
                aria-checked={locale === item}
                key={item}
                lang={item}
                onClick={() => {
                  setLocale(item);
                  closeTo(languageTrigger.current);
                }}
                role="menuitemradio"
                type="button"
              >
                <span>{item === "en" ? "English" : "Deutsch"}</span>
                {locale === item && <Check size={17} aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="preference-popup">
        <button
          aria-expanded={popup === "theme"}
          aria-haspopup="menu"
          aria-label={text(
            `Appearance: ${selectedTheme.label}`,
            `Darstellung: ${selectedTheme.label}`,
          )}
          className="preference-trigger"
          onClick={() =>
            setPopup((current) => (current === "theme" ? null : "theme"))
          }
          ref={themeTrigger}
          type="button"
        >
          <ThemeIcon size={18} aria-hidden="true" />
          <span>{selectedTheme.label}</span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        {popup === "theme" && (
          <div
            className="preference-menu theme-menu"
            role="menu"
            aria-label={text("Choose appearance", "Darstellung wählen")}
          >
            {themes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  aria-checked={theme === item.value}
                  key={item.value}
                  onClick={() => chooseTheme(item.value)}
                  role="menuitemradio"
                  type="button"
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{item.label}</span>
                  {theme === item.value && (
                    <Check size={17} aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
