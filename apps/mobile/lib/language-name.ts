const languageNames = {
  de: {
    de: "Deutsch",
    en: "Englisch",
    es: "Spanisch",
    fr: "Französisch",
    it: "Italienisch",
    pt: "Portugiesisch",
  },
  en: {
    de: "German",
    en: "English",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
  },
} as const;

type DisplayNamesConstructor = new (
  locales?: string | string[],
  options?: { type: "language" },
) => { of(code: string): string | undefined };

export function getMobileLanguageName(
  locale: string,
  uiLocale: string,
  displayNamesConstructor: DisplayNamesConstructor | null | undefined = (
    Intl as typeof Intl & { DisplayNames?: DisplayNamesConstructor }
  ).DisplayNames,
): string {
  const language = locale.split("-")[0]?.toLowerCase() || locale.toLowerCase();
  const uiLanguage = uiLocale.split("-")[0]?.toLowerCase() || "en";

  if (typeof displayNamesConstructor === "function") {
    try {
      const resolved = new displayNamesConstructor([uiLocale], {
        type: "language",
      }).of(language);
      if (resolved) return resolved;
    } catch {
      // Hermes builds do not consistently provide the complete Intl API.
    }
  }

  const names =
    languageNames[uiLanguage as keyof typeof languageNames] ?? languageNames.en;
  return names[language as keyof typeof names] ?? language.toUpperCase();
}
