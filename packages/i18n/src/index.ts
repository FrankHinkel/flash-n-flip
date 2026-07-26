export const product = {
  name: "Flash-n-Flip",
  domain: "flash-n-flip.com",
  motto: "Flash, Flip and Remember",
} as const;

export const en = {
  navigation: {
    today: "Today",
    decks: "My decks",
    learn: "Study",
    discover: "Discover",
    settings: "Settings",
  },
  study: {
    question: "Question",
    answer: "Answer",
    reveal: "Show answer",
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
    complete: "You are done for today.",
  },
  sync: {
    offline: "Offline – changes will sync later.",
    synced: "All changes are synchronized.",
  },
  moderation: {
    submitted: "Submitted",
    inReview: "In review",
    changesRequested: "Changes requested",
    approved: "Approved",
    published: "Published",
    suspended: "Suspended",
  },
} as const;

type TranslationShape = {
  [Section in keyof typeof en]: {
    [Key in keyof (typeof en)[Section]]: string;
  };
};

export const de: TranslationShape = {
  navigation: {
    today: "Heute",
    decks: "Meine Lernsets",
    learn: "Lernen",
    discover: "Entdecken",
    settings: "Einstellungen",
  },
  study: {
    question: "Frage",
    answer: "Antwort",
    reveal: "Antwort zeigen",
    again: "Nochmal",
    hard: "Schwer",
    good: "Gut",
    easy: "Leicht",
    complete: "Für heute ist alles geschafft.",
  },
  sync: {
    offline: "Offline – Änderungen werden später synchronisiert.",
    synced: "Alle Änderungen wurden synchronisiert.",
  },
  moderation: {
    submitted: "Eingereicht",
    inReview: "In Prüfung",
    changesRequested: "Änderungen nötig",
    approved: "Freigegeben",
    published: "Veröffentlicht",
    suspended: "Gesperrt",
  },
};

export const supportedLocales = ["en", "de"] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = "en";
export const translations = { en, de } as const;

export function isLocale(value: unknown): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function selectTranslation(
  locale: Locale,
  english: string,
  german: string,
): string {
  return locale === "de" ? german : english;
}

export function translate<
  Section extends keyof typeof en,
  Key extends keyof (typeof en)[Section],
>(locale: Locale, section: Section, key: Key): string {
  const selected: TranslationShape = translations[locale];
  return selected[section][key];
}
