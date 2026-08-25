"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getLocalProductSettings,
  patchLocalProductSettings,
} from "../lib/local-product-repository";

import { useI18n } from "./i18n-provider";
import { themeStatusIcon, type ThemePreference } from "./theme-toggle-state";

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
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemePreference>("bright");
  const inStudyMode = pathname.startsWith("/app/learn");

  useEffect(() => {
    const stored = localStorage.getItem(themeKey);
    const next = isThemePreference(stored) ? stored : "bright";
    setTheme(next);
    localStorage.setItem(themeKey, next);
    applyTheme(next);
    void getLocalProductSettings().then((settings) => {
      const local =
        settings?.theme === "DARK"
          ? "dark"
          : settings?.theme === "LIGHT"
            ? "bright"
            : null;
      if (!local) return;
      setTheme(local);
      localStorage.setItem(themeKey, local);
      applyTheme(local);
    });
  }, []);

  function toggleTheme() {
    const next = theme === "bright" ? "dark" : "bright";
    setTheme(next);
    localStorage.setItem(themeKey, next);
    applyTheme(next);
    void patchLocalProductSettings({
      theme: next === "dark" ? "DARK" : "LIGHT",
    });
  }

  const label =
    theme === "bright"
      ? text("legacy.ac7660b09700")
      : text("legacy.350df330c6b0");
  const statusIcon = themeStatusIcon(theme);

  return (
    <button
      aria-label={label}
      className={`theme-toggle${inStudyMode ? " study-theme-toggle" : ""}`}
      data-theme-state={theme}
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {statusIcon === "sun" ? (
        <Sun size={20} aria-hidden="true" />
      ) : (
        <Moon size={20} aria-hidden="true" />
      )}
    </button>
  );
}
