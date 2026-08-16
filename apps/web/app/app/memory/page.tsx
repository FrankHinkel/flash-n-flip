import type { ReviewRating } from "@flashcards/domain";

import { MemoryGame } from "../../../components/memory-game";
import { defaultContinueRatings } from "../../../components/study-continue";

export const metadata = { title: "Memory" };

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    deckId?: string;
    ratings?: string;
    pairs?: string;
  }>;
}) {
  const { deckId, ratings, pairs } = await searchParams;
  const validRatings = new Set<ReviewRating>(["AGAIN", "HARD", "GOOD", "EASY"]);
  const selectedRatings = (ratings ?? "")
    .split(",")
    .filter((rating): rating is ReviewRating =>
      validRatings.has(rating as ReviewRating),
    );
  const pairCount = Number(pairs);

  return (
    <MemoryGame
      deckId={deckId}
      ratings={
        selectedRatings.length ? selectedRatings : [...defaultContinueRatings]
      }
      initialPairCount={[4, 6, 8, 10, 12].includes(pairCount) ? pairCount : 6}
    />
  );
}
