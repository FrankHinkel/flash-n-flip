import type { DeckSummary } from "@flashcards/api-client";

export const languageHubTitle = "Language Hub";

// Persisted legacy identity. Changing it would split existing local collections.
export const languageHubTemplateKey = "xefjord-complete-collection";

export const languageHubTag = "Language Hub";
export const dictionaryDeckTag = "Dictionary";
export const languageNeutralTag = "Language Neutral";
export const dictionaryPivotDisabledTag = "Dictionary Pivot Disabled";
export const dictionaryLocaleTagPrefix = "dictionary-locale:";
export const dictionaryPivotTagPrefix = "dictionary-pivot:";

const legacyLanguageDeckPattern = /^xefjord['’]s complete\s+(.+)$/i;

type LanguageHubDeck = Pick<
  DeckSummary,
  | "id"
  | "parentDeckId"
  | "title"
  | "tags"
  | "sourceLocale"
  | "targetLocale"
  | "contentLocales"
  | "sourceTemplateKey"
>;

const normalizedLocale = (value: string | null | undefined): string | null => {
  const locale = value?.trim().toLocaleLowerCase();
  return locale || null;
};

export const languageHubLanguageTitle = (title: string): string =>
  title.match(legacyLanguageDeckPattern)?.[1]?.trim() || title;

export const isLanguageHubCollection = (
  deck: Pick<LanguageHubDeck, "sourceTemplateKey" | "tags">,
): boolean =>
  deck.sourceTemplateKey === languageHubTemplateKey ||
  deck.tags.includes(languageHubTag);

export const dictionaryDeckLocale = (
  deck: Pick<
    LanguageHubDeck,
    "tags" | "sourceLocale" | "targetLocale" | "contentLocales"
  >,
): string | null => {
  const tagged = deck.tags
    .find((tag) => tag.startsWith(dictionaryLocaleTagPrefix))
    ?.slice(dictionaryLocaleTagPrefix.length);
  if (tagged) return normalizedLocale(tagged);
  const source = normalizedLocale(deck.sourceLocale);
  const target = normalizedLocale(deck.targetLocale);
  if (source && target && source !== target) return target;
  const locales = [
    ...new Set(deck.contentLocales.map(normalizedLocale).filter(Boolean)),
  ] as string[];
  return locales.length === 2 && locales.includes("en")
    ? (locales.find((locale) => locale !== "en") ?? null)
    : null;
};

export const isDictionaryLanguageDeck = (
  deck: Pick<
    LanguageHubDeck,
    "title" | "tags" | "sourceLocale" | "targetLocale" | "contentLocales"
  >,
): boolean =>
  !deck.tags.includes(languageNeutralTag) &&
  (deck.tags.includes(dictionaryDeckTag) ||
    (legacyLanguageDeckPattern.test(deck.title.trim()) &&
      deck.tags.includes("Anki Import")));

export const hasReliableDictionaryDirection = (
  deck: Pick<
    LanguageHubDeck,
    "tags" | "sourceLocale" | "targetLocale" | "contentLocales"
  >,
): boolean => {
  if (
    deck.tags.includes(languageNeutralTag) ||
    deck.tags.includes(dictionaryPivotDisabledTag)
  ) {
    return false;
  }
  const locale = dictionaryDeckLocale(deck);
  const source = normalizedLocale(deck.sourceLocale);
  const target = normalizedLocale(deck.targetLocale);
  return Boolean(locale && source && target && source !== target);
};

export const languageHubCollectionTags = (
  tags: readonly string[] = [],
): string[] => [
  ...new Set([
    ...tags.filter(
      (tag) =>
        tag !== dictionaryDeckTag &&
        tag !== dictionaryPivotDisabledTag &&
        !tag.startsWith(dictionaryLocaleTagPrefix) &&
        !tag.startsWith(dictionaryPivotTagPrefix),
    ),
    "Anki Import",
    "Collection",
    languageHubTag,
    languageNeutralTag,
  ]),
];

export const dictionaryLanguageDeckTags = (input: {
  tags?: readonly string[];
  locale: string | null;
  pivotLocale?: string;
  pivotDisabled?: boolean;
  neutral?: boolean;
}): string[] => {
  const locale = normalizedLocale(input.locale);
  const pivot = normalizedLocale(input.pivotLocale ?? "en") ?? "en";
  return [
    ...new Set([
      ...(input.tags ?? []).filter(
        (tag) =>
          tag !== languageNeutralTag &&
          tag !== dictionaryPivotDisabledTag &&
          !tag.startsWith(dictionaryLocaleTagPrefix) &&
          !tag.startsWith(dictionaryPivotTagPrefix),
      ),
      "Anki Import",
      languageHubTag,
      dictionaryDeckTag,
      ...(input.neutral ? [languageNeutralTag] : []),
      ...(locale ? [`${dictionaryLocaleTagPrefix}${locale}`] : []),
      ...(locale && !input.neutral
        ? [`${dictionaryPivotTagPrefix}${pivot}`]
        : []),
      ...(input.pivotDisabled ? [dictionaryPivotDisabledTag] : []),
    ]),
  ];
};

export const canonicalDictionaryDecks = <T extends LanguageHubDeck>(
  decks: readonly T[],
): T[] => {
  const ordered = [...decks]
    .filter(
      (deck) =>
        isDictionaryLanguageDeck(deck) && hasReliableDictionaryDirection(deck),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const seen = new Set<string>();
  return ordered.filter((deck) => {
    const locale = dictionaryDeckLocale(deck);
    if (!locale) return false;
    const key = `${deck.parentDeckId ?? ""}:${locale}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const languageHubDeckIsNeutral = (
  deck: Pick<LanguageHubDeck, "tags" | "sourceLocale" | "targetLocale">,
): boolean =>
  deck.tags.includes(languageNeutralTag) ||
  normalizedLocale(deck.sourceLocale) === normalizedLocale(deck.targetLocale);
