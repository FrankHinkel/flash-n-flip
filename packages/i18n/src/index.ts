export const de = {
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
} as const;

type TranslationShape = {
  [Section in keyof typeof de]: {
    [Key in keyof (typeof de)[Section]]: string;
  };
};

export const en: TranslationShape = {
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
};

export type Locale = "de" | "en";
export const translations = { de, en } as const;

export function translate<
  Section extends keyof typeof de,
  Key extends keyof (typeof de)[Section],
>(locale: Locale, section: Section, key: Key): string {
  const selected: TranslationShape = translations[locale];
  return selected[section][key];
}
