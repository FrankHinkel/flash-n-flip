"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  defaultLocale,
  isLocale,
  isUiMessageKey,
  translateUiMessage,
  type Locale,
  type UiMessageKey,
  type UiMessageValue,
} from "@flashcards/i18n";

import {
  getLocalProductSettings,
  patchLocalProductSettings,
} from "../lib/local-product-repository";

const localeKey = "flash-n-flip.locale.v1";

function cacheLocale(locale: Locale): void {
  try {
    localStorage.setItem(localeKey, locale);
  } catch {
    // Browser storage can be unavailable; the local repository remains primary.
  }
}

export type I18nText = (
  key: UiMessageKey,
  values?: readonly UiMessageValue[],
) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: I18nText;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const selectionVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = selectionVersion.current;
    try {
      const stored = localStorage.getItem(localeKey);
      if (isLocale(stored)) setLocaleState(stored);
    } catch {
      // Keep the default until the authoritative settings can be read.
    }
    void getLocalProductSettings()
      .then((settings) => {
        if (
          active &&
          selectionVersion.current === version &&
          isLocale(settings?.locale)
        ) {
          setLocaleState(settings.locale);
          cacheLocale(settings.locale);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    selectionVersion.current += 1;
    setLocaleState(next);
    cacheLocale(next);
    void patchLocalProductSettings({ locale: next }).catch(() => undefined);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      text: (key, values) => translateUiMessage(locale, key, values),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext);
}
