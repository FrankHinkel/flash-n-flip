"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "./i18n-provider";

type ThemePreference = "dark" | "bright";

const themeKey = "flash-n-flip.theme.v1";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "dark" || value === "bright";
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.theme = preference;
  root.dataset.resolvedTheme = preference;
}

export function ThemeToggle() {
  const { text } = useI18n();
  const [theme, setTheme] = useState<ThemePreference>("bright");

  useEffect(() => {
    const stored = localStorage.getItem(themeKey);
    const next = isThemePreference(stored) ? stored : "bright";
    setTheme(next);
    localStorage.setItem(themeKey, next);
    applyTheme(next);
  }, []);

  function toggleTheme() {
    const next = theme === "bright" ? "dark" : "bright";
    setTheme(next);
    localStorage.setItem(themeKey, next);
    applyTheme(next);
  }

  const nextLabel =
    theme === "bright"
      ? text("Switch to dark mode", "Zum Dunkelmodus wechseln")
      : text("Switch to bright mode", "Zum Hellmodus wechseln");

  return (
    <button
      aria-label={nextLabel}
      className="theme-toggle"
      onClick={toggleTheme}
      title={nextLabel}
      type="button"
    >
      {theme === "bright" ? (
        <Moon size={20} aria-hidden="true" />
      ) : (
        <Sun size={20} aria-hidden="true" />
      )}
    </button>
  );
}
