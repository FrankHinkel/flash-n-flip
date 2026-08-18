import type { ReviewRating } from "@flashcards/domain";

import { defaultContinueRatings } from "./study-continue";

const validMemoryRatings = new Set<ReviewRating>([
  "AGAIN",
  "HARD",
  "GOOD",
  "EASY",
]);

const validMemoryPairCounts = new Set([4, 6, 8, 10, 12]);

export type MemoryRouteSelection = {
  deckId: string;
  ratings: ReviewRating[];
  pairCount: number;
};

export function resolveMemoryRouteSelection(
  searchParams: Pick<URLSearchParams, "get">,
): MemoryRouteSelection {
  const ratings = (searchParams.get("ratings") ?? "")
    .split(",")
    .filter((rating): rating is ReviewRating =>
      validMemoryRatings.has(rating as ReviewRating),
    );
  const pairCount = Number(searchParams.get("pairs"));
  return {
    deckId: searchParams.get("deckId") ?? "",
    ratings: ratings.length ? ratings : [...defaultContinueRatings],
    pairCount: validMemoryPairCounts.has(pairCount) ? pairCount : 4,
  };
}
