"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  defaultLocale,
  isLocale,
  isUiMessageKey,
  selectTranslation,
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

export type I18nText = {
  (key: UiMessageKey, values?: readonly UiMessageValue[]): string;
  (english: string, german: string, spanish?: string, french?: string): string;
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  text: I18nText;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const stored = localStorage.getItem(localeKey);
    if (isLocale(stored)) setLocaleState(stored);
    void getLocalProductSettings().then((settings) => {
      if (isLocale(settings?.locale)) {
        setLocaleState(settings.locale);
        localStorage.setItem(localeKey, settings.locale);
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(localeKey, next);
    void patchLocalProductSettings({ locale: next });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      text: ((
        keyOrEnglish: UiMessageKey | string,
        valuesOrGerman?: readonly UiMessageValue[] | string,
        spanish?: string,
        french?: string,
      ) => {
        if (
          isUiMessageKey(keyOrEnglish) &&
          (valuesOrGerman === undefined || Array.isArray(valuesOrGerman))
        ) {
          return translateUiMessage(
            locale,
            keyOrEnglish,
            valuesOrGerman as readonly UiMessageValue[] | undefined,
          );
        }
        return selectTranslation(
          locale,
          keyOrEnglish,
          valuesOrGerman as string,
          spanish,
          french,
        );
      }) as I18nText,
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
