import type { DeckSummary } from "@flashcards/api-client";

export const xefjordCollectionTitle = "Language Hub";
export const xefjordCollectionTemplateKey = "xefjord-complete-collection";
export const xefjordLanguageDeckPattern = /^xefjord['’]s complete\s+(.+)$/i;

export const xefjordLanguageTitle = (title: string): string =>
  title.match(xefjordLanguageDeckPattern)?.[1]?.trim() || title;

export const isXefjordLanguageDeck = (
  deck: Pick<DeckSummary, "title" | "tags">,
): boolean =>
  xefjordLanguageDeckPattern.test(deck.title.trim()) &&
  deck.tags.includes("Anki Import");
