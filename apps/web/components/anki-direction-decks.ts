import type { DeckSummary } from "@flashcards/api-client";

import {
  studyLanguageDirectionCode,
  studyLanguageDirectionKey,
  type StudyLanguageDirection,
} from "./study-language-direction";

export type AnkiDirectionDeck = {
  direction: StudyLanguageDirection;
  directionKey: string;
  title: string;
  cardCount: number;
  reviewedCardCount: number;
};

const xefjordLanguageDeckPattern = /^xefjord['’]s complete\s+(.+)$/i;

const parsedDirection = (key: string): StudyLanguageDirection | null => {
  const separator = key.indexOf("→");
  if (separator <= 0 || separator === key.length - 1) return null;
  const questionLocale = key.slice(0, separator).trim();
  const answerLocale = key.slice(separator + 1).trim();
  if (!questionLocale || !answerLocale || questionLocale === answerLocale) {
    return null;
  }
  return { questionLocale, answerLocale };
};

export const isAnkiLanguageDeck = (deck: DeckSummary): boolean =>
  deck.tags.includes("Anki Import") &&
  !deck.tags.includes("Collection") &&
  deck.sourceTemplateKey !== "xefjord-complete-collection";

export const ankiLanguageDeckBaseTitle = (deck: DeckSummary): string =>
  deck.title.match(xefjordLanguageDeckPattern)?.[1]?.trim() || deck.title;

export function ankiDirectionDecks(deck: DeckSummary): AnkiDirectionDeck[] {
  if (!isAnkiLanguageDeck(deck)) return [];
  const entries = Object.entries(deck.cardDirections ?? {}).flatMap(
    ([key, metrics]) => {
      const direction = parsedDirection(key);
      return direction && metrics.cardCount > 0 ? [{ direction, metrics }] : [];
    },
  );
  const locales = new Set(
    entries.flatMap(({ direction }) => [
      direction.questionLocale,
      direction.answerLocale,
    ]),
  );
  if (entries.length !== 2 || locales.size !== 2) return [];
  const keys = new Set(
    entries.map(({ direction }) => studyLanguageDirectionKey(direction)),
  );
  if (
    !entries.every(({ direction }) =>
      keys.has(
        studyLanguageDirectionKey({
          questionLocale: direction.answerLocale,
          answerLocale: direction.questionLocale,
        }),
      ),
    )
  ) {
    return [];
  }
  const baseTitle = ankiLanguageDeckBaseTitle(deck);
  return entries
    .sort((left, right) => {
      const preferredQuestionLocale = locales.has("en")
        ? "en"
        : deck.sourceLocale;
      if (left.direction.questionLocale === preferredQuestionLocale) return -1;
      if (right.direction.questionLocale === preferredQuestionLocale) return 1;
      return studyLanguageDirectionKey(left.direction).localeCompare(
        studyLanguageDirectionKey(right.direction),
      );
    })
    .map(({ direction, metrics }) => ({
      direction,
      directionKey: studyLanguageDirectionKey(direction),
      title: `${baseTitle} (${studyLanguageDirectionCode(direction)})`,
      cardCount: metrics.cardCount,
      reviewedCardCount: metrics.reviewedCardCount,
    }));
}

export function ankiMixedDeckTitle(deck: DeckSummary): string {
  const variants = ankiDirectionDecks(deck);
  if (variants.length !== 2) return deck.title;
  const detectedLocales = [
    ...new Set(
      variants.flatMap(({ direction }) => [
        direction.questionLocale,
        direction.answerLocale,
      ]),
    ),
  ];
  const preferredLocale = detectedLocales.includes("en")
    ? "en"
    : deck.sourceLocale;
  const locales = [
    preferredLocale,
    ...detectedLocales.filter((locale) => locale !== preferredLocale),
  ];
  return `${ankiLanguageDeckBaseTitle(deck)} (${locales
    .map((locale) => locale.toUpperCase())
    .join("↔")})`;
}
