import type { DeckSummary } from "@flashcards/api-client";

import {
  isDictionaryLanguageDeck,
  languageHubLanguageTitle,
  languageHubTemplateKey,
  languageHubTitle,
} from "./language-hub";

// Compatibility exports for persisted routes, review identities and peers.
export const xefjordCollectionTitle = languageHubTitle;
export const xefjordCollectionTemplateKey = languageHubTemplateKey;
export const xefjordLanguageDeckPattern = /^xefjord['’]s complete\s+(.+)$/i;

export const xefjordLanguageTitle = (title: string): string =>
  languageHubLanguageTitle(title);

export const isXefjordLanguageDeck = (
  deck: Pick<DeckSummary, "title" | "tags">,
): boolean =>
  isDictionaryLanguageDeck({
    ...deck,
    sourceLocale: "en",
    targetLocale: "en",
    contentLocales: [],
  });
