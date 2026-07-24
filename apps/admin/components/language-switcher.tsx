"use client";

import { useI18n } from "./i18n-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, text } = useI18n();
  return (
    <div
      className="admin-language-switcher"
      role="group"
      aria-label={text("Choose language", "Sprache wählen")}
    >
      {(["en", "de"] as const).map((item) => (
        <button
          aria-pressed={locale === item}
          key={item}
          lang={item}
          onClick={() => setLocale(item)}
          type="button"
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
