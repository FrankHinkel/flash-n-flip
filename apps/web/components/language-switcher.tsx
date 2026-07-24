"use client";

import { Languages } from "lucide-react";

import { useI18n } from "./i18n-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, text } = useI18n();
  const label = text("Choose language", "Sprache wählen");

  return (
    <div
      className={compact ? "language-switcher compact" : "language-switcher"}
      role="group"
      aria-label={label}
    >
      {!compact && <Languages size={18} aria-hidden="true" />}
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
        lang="en"
      >
        EN
      </button>
      <button
        type="button"
        aria-pressed={locale === "de"}
        onClick={() => setLocale("de")}
        lang="de"
      >
        DE
      </button>
    </div>
  );
}
