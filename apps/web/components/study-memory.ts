import type { DueCard } from "@flashcards/api-client";
import { localCardContentPlainText } from "@flashcards/direct-connect-webstack/local-app";
import type { ReviewRating } from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";
import type { ContentStyleDefinition } from "@flashcards/domain/content-style";

export type MemoryPair = {
  id: string;
  questionText: string;
  answerText: string;
  questionContent: CardContent;
  answerContent: CardContent;
  questionLocale?: string;
  answerLocale?: string;
  contentStyles?: readonly ContentStyleDefinition[];
};

export type MemoryTile = {
  id: string;
  pairId: string;
  side: "question" | "answer";
  content: CardContent;
  locale?: string;
  contentStyles?: readonly ContentStyleDefinition[];
};

export const memoryPairSizes = [4, 6, 8, 10, 12] as const;

export function memoryFailureLimit(pairCount: number): number {
  return Math.min(4, Math.ceil(pairCount / 4) + 1);
}

export function countMemoryTileFailures(
  current: Readonly<Record<string, number>>,
  failedTileIds: readonly string[],
  failureLimit: number,
): {
  failures: Record<string, number>;
  newlyMarkedTileIds: string[];
} {
  const failures = { ...current };
  const newlyMarkedTileIds: string[] = [];
  for (const tileId of new Set(failedTileIds)) {
    const previous = failures[tileId] ?? 0;
    const next = previous + 1;
    failures[tileId] = next;
    if (previous < failureLimit && next >= failureLimit) {
      newlyMarkedTileIds.push(tileId);
    }
  }
  return { failures, newlyMarkedTileIds };
}

export function memoryPairIdsForTileIds(
  tiles: readonly Pick<MemoryTile, "id" | "pairId">[],
  tileIds: readonly string[],
): string[] {
  const selectedTileIds = new Set(tileIds);
  return [
    ...new Set(
      tiles
        .filter((tile) => selectedTileIds.has(tile.id))
        .map((tile) => tile.pairId),
    ),
  ];
}

export function memorySelectionAfterTileClick(
  selectedTileIds: readonly string[],
  tileId: string,
): string[] {
  if (selectedTileIds.length >= 2) return [tileId];
  if (selectedTileIds.includes(tileId)) return [...selectedTileIds];
  return [...selectedTileIds, tileId];
}

const shortMemoryText = (value: string): string | null => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 0 && text.length <= 180 ? text : null;
};

export function memoryPairsFromCards(
  cards: readonly DueCard[],
  ratings: readonly ReviewRating[],
  pairCount: number,
): MemoryPair[] {
  const selectedRatings = new Set(ratings);
  const questions = new Set<string>();
  const answers = new Set<string>();
  const pairs: MemoryPair[] = [];
  for (const due of cards) {
    if (
      due.studyMode !== "LEARNING" ||
      !due.lastRating ||
      !selectedRatings.has(due.lastRating)
    ) {
      continue;
    }
    const question = shortMemoryText(localCardContentPlainText(due.card.front));
    const answer = shortMemoryText(localCardContentPlainText(due.card.back));
    if (
      !question ||
      !answer ||
      question.localeCompare(answer, undefined, { sensitivity: "base" }) ===
        0 ||
      questions.has(question.toLocaleLowerCase()) ||
      answers.has(answer.toLocaleLowerCase())
    ) {
      continue;
    }
    questions.add(question.toLocaleLowerCase());
    answers.add(answer.toLocaleLowerCase());
    pairs.push({
      id: due.card.id,
      questionText: question,
      answerText: answer,
      questionContent: due.card.front,
      answerContent: due.card.back,
      questionLocale: due.card.questionLocale ?? undefined,
      answerLocale: due.card.answerLocale ?? undefined,
      contentStyles: due.contentStyles,
    });
    if (pairs.length >= pairCount) break;
  }
  return pairs;
}

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

export function shuffledMemoryTiles(
  pairs: readonly MemoryPair[],
  roundKey: string,
): MemoryTile[] {
  return pairs
    .flatMap((pair) => [
      {
        id: `${pair.id}:question`,
        pairId: pair.id,
        side: "question" as const,
        content: pair.questionContent,
        locale: pair.questionLocale,
        contentStyles: pair.contentStyles,
      },
      {
        id: `${pair.id}:answer`,
        pairId: pair.id,
        side: "answer" as const,
        content: pair.answerContent,
        locale: pair.answerLocale,
        contentStyles: pair.contentStyles,
      },
    ])
    .map((tile) => ({ tile, order: hash(`${roundKey}:${tile.id}`) }))
    .sort(
      (left, right) =>
        left.order - right.order || left.tile.id.localeCompare(right.tile.id),
    )
    .map(({ tile }) => tile);
}
