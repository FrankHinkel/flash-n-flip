"use client";

import type {
  DeckDetail,
  DeckSummary,
  DueCard,
  XefjordCrossLanguageDeck,
  XefjordCrossLanguageMode,
  XefjordCrossLanguagePair,
} from "@flashcards/api-client";
import { createId, deckDescendantIds } from "@flashcards/domain";
import {
  cardContentPlainText,
  type CardContent,
  type ContentBlock,
} from "@flashcards/domain/content";
import { IncrementalSha256 } from "@flashcards/peer-transfer";
import { emptyCardState, previewRatings } from "@flashcards/scheduler";

import {
  getCachedDeckDetail,
  getCachedDecks,
  getCachedDueCards,
  isLocallyTransferredDeck,
} from "./offline";
import {
  isXefjordLanguageDeck,
  xefjordCollectionTemplateKey,
  xefjordCollectionTitle,
  xefjordLanguageTitle,
} from "./xefjord-deck";

const normalizePivot = (value: string): string =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en");

const textBytes = (value: string): Uint8Array =>
  new TextEncoder().encode(value);

const digest = (value: string): string =>
  new IncrementalSha256().update(textBytes(value)).digestHex();

const uuidFromDigest = (value: string): string => {
  const hex = digest(value).slice(0, 32).split("");
  hex[12] = "8";
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
};

const matchKeyForPivot = (pivot: string): string =>
  digest(`flash-n-flip:xefjord-pivot:v1:${normalizePivot(pivot)}`);

const virtualCardId = (
  questionDeckId: string,
  answerDeckId: string,
  matchKey: string,
): string =>
  uuidFromDigest(
    `flash-n-flip:xefjord-cross-card:v1:${questionDeckId}:${answerDeckId}:${matchKey}`,
  );

type LocalPhraseEntry = {
  noteId: string;
  pivot: string;
  english: string;
  phrase: CardContent;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const isPhraseBlock = (block: ContentBlock): boolean =>
  block.type !== "audio" &&
  block.type !== "video" &&
  block.type !== "animation" &&
  block.type !== "image" &&
  block.type !== "imageOverlay";

const phraseContent = (content: CardContent): CardContent => ({
  blocks: content.blocks.filter(isPhraseBlock),
});

const questionContent = (entry: LocalPhraseEntry): CardContent => ({
  blocks: [
    ...entry.phrase.blocks.filter(isPhraseBlock),
    ...entry.phrase.blocks.filter((block) => block.type === "audio"),
  ],
});

const answerContent = (entry: LocalPhraseEntry): CardContent => ({
  blocks: [
    ...entry.phrase.blocks.filter(isPhraseBlock),
    ...entry.phrase.blocks.filter(
      (block) =>
        block.type === "image" ||
        block.type === "imageOverlay" ||
        block.type === "audio",
    ),
  ],
});

const englishContent = (entry: LocalPhraseEntry): CardContent => ({
  blocks: [{ type: "text", text: entry.english, marks: { italic: true } }],
});

export const uniqueXefjordPhraseEntries = (
  decks: readonly DeckDetail[],
  locale: string,
): Map<string, LocalPhraseEntry> => {
  const cards = decks.flatMap((deck) => deck.cards);
  const cardsByNote = new Map<string, typeof cards>();
  for (const card of cards) {
    cardsByNote.set(card.noteId, [
      ...(cardsByNote.get(card.noteId) ?? []),
      card,
    ]);
  }
  const grouped = new Map<string, LocalPhraseEntry[]>();
  for (const [noteId, noteCards] of cardsByNote) {
    const foreignToEnglish = noteCards.filter(
      (card) => card.questionLocale === locale && card.answerLocale === "en",
    );
    const englishToForeign = noteCards.filter(
      (card) => card.questionLocale === "en" && card.answerLocale === locale,
    );
    if (foreignToEnglish.length !== 1 || englishToForeign.length !== 1)
      continue;
    const foreignCard = foreignToEnglish[0]!;
    const englishCard = englishToForeign[0]!;
    const english = cardContentPlainText(englishCard.front)
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
    const reverseEnglish = cardContentPlainText(foreignCard.back)
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim();
    const phrase = phraseContent(foreignCard.front);
    const reversePhrase = phraseContent(englishCard.back);
    const pivot = normalizePivot(english);
    if (
      !pivot ||
      pivot !== normalizePivot(reverseEnglish) ||
      !cardContentPlainText(phrase).trim() ||
      normalizePivot(cardContentPlainText(phrase)) !==
        normalizePivot(cardContentPlainText(reversePhrase))
    ) {
      continue;
    }
    const entries = grouped.get(pivot) ?? [];
    entries.push({
      noteId,
      pivot,
      english,
      phrase: foreignCard.front,
      version: Math.max(foreignCard.version, englishCard.version),
      createdAt:
        foreignCard.createdAt < englishCard.createdAt
          ? foreignCard.createdAt
          : englishCard.createdAt,
      updatedAt:
        foreignCard.updatedAt > englishCard.updatedAt
          ? foreignCard.updatedAt
          : englishCard.updatedAt,
    });
    grouped.set(pivot, entries);
  }
  return new Map(
    [...grouped]
      .filter(([, entries]) => entries.length === 1)
      .map(([pivot, entries]) => [pivot, entries[0]!] as const),
  );
};

const detailsForRoot = async (
  rootId: string,
  summaries: readonly DeckSummary[],
): Promise<DeckDetail[]> => {
  const ids = [...deckDescendantIds(summaries, rootId)];
  return (await Promise.all(ids.map((id) => getCachedDeckDetail(id)))).filter(
    (deck): deck is DeckDetail => Boolean(deck),
  );
};

export function prepareTransferredXefjordHierarchy(
  decks: readonly DeckDetail[],
  localDecks: readonly DeckSummary[],
  rootDeckIds: readonly string[],
): DeckDetail[] {
  const includedIds = new Set(decks.map((deck) => deck.id));
  const roots = new Set(rootDeckIds);
  let prepared = decks.map((deck) => ({
    ...deck,
    parentDeckId:
      roots.has(deck.id) &&
      deck.parentDeckId &&
      !includedIds.has(deck.parentDeckId)
        ? null
        : deck.parentDeckId,
  }));
  const includedCollection = prepared.find(
    (deck) => deck.sourceTemplateKey === xefjordCollectionTemplateKey,
  );
  const languageRoots = prepared.filter(
    (deck) => roots.has(deck.id) && isXefjordLanguageDeck(deck),
  );
  if (includedCollection || languageRoots.length === 0) return prepared;

  const existingCollection = localDecks.find(
    (deck) =>
      deck.sourceTemplateKey === xefjordCollectionTemplateKey &&
      !deck.archivedAt,
  );
  if (existingCollection) {
    return prepared.map((deck) =>
      languageRoots.some((root) => root.id === deck.id)
        ? { ...deck, parentDeckId: existingCollection.id }
        : deck,
    );
  }

  const basis = languageRoots[0]!;
  const collectionId = createId();
  const collection: DeckDetail = {
    ...basis,
    id: collectionId,
    parentDeckId: null,
    title: xefjordCollectionTitle,
    description: "",
    contentLocales: ["en"],
    defaultContentLocale: "en",
    sourceLocale: "en",
    targetLocale: "en",
    tags: ["Anki Import", "Collection"],
    favorite: false,
    hiddenAt: null,
    archivedAt: null,
    visual: null,
    sourceTemplateKey: xefjordCollectionTemplateKey,
    cards: [],
  };
  prepared = prepared.map((deck) =>
    languageRoots.some((root) => root.id === deck.id)
      ? { ...deck, parentDeckId: collectionId }
      : deck,
  );
  return [collection, ...prepared];
}

export async function getLocalXefjordCrossLanguageDecks(): Promise<
  XefjordCrossLanguageDeck[]
> {
  const summaries = await getCachedDecks(true, true);
  const collectionIds = new Set(
    summaries
      .filter(
        (deck) =>
          deck.sourceTemplateKey === xefjordCollectionTemplateKey &&
          !deck.archivedAt,
      )
      .map((deck) => deck.id),
  );
  const candidates = summaries.filter(
    (deck) =>
      Boolean(deck.parentDeckId && collectionIds.has(deck.parentDeckId)) &&
      !deck.archivedAt &&
      !deck.hiddenAt &&
      isXefjordLanguageDeck(deck),
  );
  const localCandidateIds = new Set(
    (
      await Promise.all(
        candidates.map(async (deck) => ({
          id: deck.id,
          local: await isLocallyTransferredDeck(deck.id),
        })),
      )
    )
      .filter((candidate) => candidate.local)
      .map((candidate) => candidate.id),
  );
  const eligible = await Promise.all(
    candidates
      .filter((deck) => localCandidateIds.has(deck.id))
      .map(async (deck) => {
        const entries = uniqueXefjordPhraseEntries(
          await detailsForRoot(deck.id, summaries),
          deck.targetLocale,
        );
        return entries.size
          ? {
              id: deck.id,
              collectionDeckId: deck.parentDeckId!,
              title: xefjordLanguageTitle(deck.title),
              locale: deck.targetLocale,
            }
          : null;
      }),
  );
  return eligible
    .filter((deck): deck is XefjordCrossLanguageDeck => Boolean(deck))
    .sort(
      (left, right) =>
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
}

const localPairEntries = async (sourceDeckId: string, targetDeckId: string) => {
  const languages = await getLocalXefjordCrossLanguageDecks();
  const source = languages.find((deck) => deck.id === sourceDeckId);
  const target = languages.find((deck) => deck.id === targetDeckId);
  if (
    !source ||
    !target ||
    source.collectionDeckId !== target.collectionDeckId
  ) {
    return null;
  }
  const summaries = await getCachedDecks(true, true);
  const [sourceEntries, targetEntries] = await Promise.all([
    detailsForRoot(source.id, summaries).then((details) =>
      uniqueXefjordPhraseEntries(details, source.locale),
    ),
    detailsForRoot(target.id, summaries).then((details) =>
      uniqueXefjordPhraseEntries(details, target.locale),
    ),
  ]);
  const matches = [...sourceEntries].flatMap(([pivot, sourceEntry]) => {
    const targetEntry = targetEntries.get(pivot);
    return targetEntry
      ? [
          {
            matchKey: matchKeyForPivot(pivot),
            source: sourceEntry,
            target: targetEntry,
          },
        ]
      : [];
  });
  matches.sort((left, right) => left.matchKey.localeCompare(right.matchKey));
  return { source, target, matches };
};

export async function getLocalXefjordCrossLanguagePair(
  sourceDeckId: string,
  targetDeckId: string,
): Promise<XefjordCrossLanguagePair | null> {
  const pair = await localPairEntries(sourceDeckId, targetDeckId);
  if (!pair) return null;
  const existing = new Map(
    (await getCachedDueCards()).map((due) => [due.card.id, due]),
  );
  const reviewed = (questionDeckId: string, answerDeckId: string) =>
    pair.matches.filter((match) => {
      const id = virtualCardId(questionDeckId, answerDeckId, match.matchKey);
      return (existing.get(id)?.state.reps ?? 0) > 0;
    }).length;
  const sourceReviewed = reviewed(pair.source.id, pair.target.id);
  const targetReviewed = reviewed(pair.target.id, pair.source.id);
  return {
    source: pair.source,
    target: pair.target,
    views: {
      sourceToTarget: {
        mode: "SOURCE_TO_TARGET",
        cardCount: pair.matches.length,
        reviewedCardCount: sourceReviewed,
      },
      targetToSource: {
        mode: "TARGET_TO_SOURCE",
        cardCount: pair.matches.length,
        reviewedCardCount: targetReviewed,
      },
      mixed: {
        mode: "MIXED",
        cardCount: pair.matches.length * 2,
        reviewedCardCount: sourceReviewed + targetReviewed,
      },
    },
  };
}

type LocalXefjordSelection = {
  sourceDeckId: string;
  targetDeckId: string;
  mode: XefjordCrossLanguageMode;
  questionEnglish?: boolean;
  answerEnglish?: boolean;
};

export async function getLocalXefjordDueCards(
  selection: LocalXefjordSelection,
  includeAll: boolean,
): Promise<DueCard[] | null> {
  const pair = await localPairEntries(
    selection.sourceDeckId,
    selection.targetDeckId,
  );
  if (!pair) return null;
  const now = new Date();
  const existing = new Map(
    (await getCachedDueCards()).map((due) => [due.card.id, due]),
  );
  const createDue = (
    questionDeck: XefjordCrossLanguageDeck,
    answerDeck: XefjordCrossLanguageDeck,
    question: LocalPhraseEntry,
    answer: LocalPhraseEntry,
    matchKey: string,
    position: number,
  ): DueCard => {
    const id = virtualCardId(questionDeck.id, answerDeck.id, matchKey);
    const prior = existing.get(id);
    const state = prior?.state ?? emptyCardState(now);
    return {
      card: {
        id,
        deckId: questionDeck.collectionDeckId,
        noteId: question.noteId,
        front: questionContent(question),
        back: answerContent(answer),
        translations: {},
        questionLocale: questionDeck.locale,
        answerLocale: answerDeck.locale,
        kind: "QUESTION",
        position,
        linkedToPrevious: false,
        suspended: false,
        version: Math.max(question.version, answer.version),
        createdAt:
          question.createdAt < answer.createdAt
            ? question.createdAt
            : answer.createdAt,
        updatedAt:
          question.updatedAt > answer.updatedAt
            ? question.updatedAt
            : answer.updatedAt,
      },
      virtualCard: {
        kind: "XEFJORD_CROSS_LANGUAGE_V1",
        questionDeckId: questionDeck.id,
        answerDeckId: answerDeck.id,
        matchKey,
      },
      virtualContent:
        selection.questionEnglish || selection.answerEnglish
          ? {
              questionEnglish: selection.questionEnglish
                ? englishContent(question)
                : undefined,
              answerEnglish: selection.answerEnglish
                ? englishContent(answer)
                : undefined,
            }
          : undefined,
      studyMode: prior?.studyMode ?? "LEARNING",
      lastRating: prior?.lastRating ?? null,
      state,
      preview: prior?.preview ?? previewRatings(state, now),
    };
  };
  const cards = pair.matches.flatMap((match, index) => {
    const sourceToTarget = createDue(
      pair.source,
      pair.target,
      match.source,
      match.target,
      match.matchKey,
      index * 2 + 1,
    );
    const targetToSource = createDue(
      pair.target,
      pair.source,
      match.target,
      match.source,
      match.matchKey,
      index * 2 + 2,
    );
    if (selection.mode === "SOURCE_TO_TARGET") return [sourceToTarget];
    if (selection.mode === "TARGET_TO_SOURCE") return [targetToSource];
    return [sourceToTarget, targetToSource];
  });
  const ordered =
    selection.mode === "MIXED"
      ? cards
      : cards.map((item, index) => ({
          ...item,
          card: { ...item.card, position: index + 1 },
        }));
  return includeAll
    ? ordered
    : ordered.filter((item) => Date.parse(item.state.due) <= now.getTime());
}
