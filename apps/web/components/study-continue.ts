import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

export const defaultContinueRatings: ReviewRating[] = ["AGAIN", "HARD", "GOOD"];

export function applySessionRatings(
  cards: readonly DueCard[],
  ratings: Readonly<Record<string, ReviewRating>>,
): DueCard[] {
  return cards.map((card) => {
    const lastRating = ratings[card.card.id];
    return lastRating ? { ...card, lastRating } : card;
  });
}

export function toggleContinueRating(
  ratings: readonly ReviewRating[],
  rating: ReviewRating,
): ReviewRating[] {
  return ratings.includes(rating)
    ? ratings.filter((value) => value !== rating)
    : [...ratings, rating];
}

export function continueRatingCounts(
  cards: readonly DueCard[],
): Record<ReviewRating, number> {
  const counts: Record<ReviewRating, number> = {
    AGAIN: 0,
    HARD: 0,
    GOOD: 0,
    EASY: 0,
  };
  for (const card of cards) {
    if (card.studyMode === "LEARNING" && card.lastRating) {
      counts[card.lastRating] += 1;
    }
  }
  return counts;
}

export function cardsForContinuedStudy(
  cards: readonly DueCard[],
  ratings: readonly ReviewRating[],
): DueCard[] {
  const selected = new Set(ratings);
  return cards.filter(
    (card) =>
      card.studyMode === "LEARNING" &&
      Boolean(card.lastRating && selected.has(card.lastRating)),
  );
}
