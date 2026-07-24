"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  defaultLocale,
  isLocale,
  selectTranslation,
  type Locale,
} from "@flashcards/i18n";

const localeKey = "flash-n-flip.admin.locale.v1";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: (english: string, german: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const stored = localStorage.getItem(localeKey);
    if (isLocale(stored)) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem(localeKey, next);
  }

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      text: (english: string, german: string) =>
        selectTranslation(locale, english, german),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
