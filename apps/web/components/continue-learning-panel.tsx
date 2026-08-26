"use client";

import { Grid3X3, Plus, RotateCcw, Settings2 } from "lucide-react";
import Link from "next/link";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";
import type { UiMessageKey } from "@flashcards/i18n";

import { useI18n } from "./i18n-provider";
import {
  cardsForContinuedStudy,
  continueCandidateWindowSize,
  continueRatingCounts,
  continueStudyBatchSize,
  extraNewStudyBatch,
  toggleContinueRating,
} from "./study-continue";
import { memoryPairsFromCards } from "./study-memory";

const ratingLabels: Record<ReviewRating, UiMessageKey> = {
  AGAIN: "study.rating.again",
  HARD: "study.rating.hard",
  GOOD: "study.rating.good",
  EASY: "study.rating.easy",
};

export function ContinueLearningPanel({
  candidates,
  ratings,
  onRatingsChange,
  onPractice,
  onExtraNew,
  deckId = "",
  loading = false,
  error = false,
}: {
  candidates: readonly DueCard[];
  ratings: readonly ReviewRating[];
  onRatingsChange: (ratings: ReviewRating[]) => void;
  onPractice?: () => void;
  onExtraNew?: () => void;
  deckId?: string;
  loading?: boolean;
  error?: boolean;
}) {
  const { text } = useI18n();
  const preferredMemoryPairs = 4;
  const counts = continueRatingCounts(candidates);
  const repeatCount = cardsForContinuedStudy(candidates, ratings).length;
  const repeatBatchCount = Math.min(continueStudyBatchSize, repeatCount);
  const repeatWindowIsBounded =
    candidates.filter(
      (card) => card.studyMode === "LEARNING" && card.state.reps > 0,
    ).length >= continueCandidateWindowSize;
  const newCount = extraNewStudyBatch(candidates).length;
  const memoryPairCount = memoryPairsFromCards(
    candidates,
    ratings,
    preferredMemoryPairs,
  ).length;
  const memoryPairs = memoryPairCount >= preferredMemoryPairs ? 4 : 0;
  const memorySearch = new URLSearchParams();
  if (deckId) memorySearch.set("deckId", deckId);
  memorySearch.set("ratings", ratings.join(","));
  memorySearch.set("pairs", String(memoryPairs));

  return (
    <section
      className="continue-learning-panel"
      aria-labelledby="continue-learning-heading"
    >
      <div className="continue-learning-heading-row">
        <div>
          <span className="eyebrow">{text("legacy.a759d579abc4")}</span>
          <h2 id="continue-learning-heading">{text("legacy.a870ec256475")}</h2>
        </div>
      </div>

      {loading ? (
        <span className="continue-learning-status" role="status">
          <RotateCcw className="spin" aria-hidden="true" />
          {text("legacy.42878dc6dda3")}
        </span>
      ) : error ? (
        <span className="continue-learning-status" role="alert">
          {text("legacy.7dbd926923a0")}
        </span>
      ) : (
        <>
          <div className="continue-learning-actions">
            {newCount > 0 ? (
              <button type="button" onClick={onExtraNew}>
                <Plus aria-hidden="true" />
                <span>{text("legacy.34eb5df0db38", [newCount])}</span>
              </button>
            ) : null}
            {repeatBatchCount > 0 ? (
              <button type="button" onClick={onPractice}>
                <RotateCcw aria-hidden="true" />
                <span>
                  {repeatCount > continueStudyBatchSize &&
                  !repeatWindowIsBounded
                    ? text("legacy.435603f73d5b", [
                        repeatBatchCount,
                        repeatCount,
                      ])
                    : text("legacy.bfdddeb40282", [repeatBatchCount])}
                </span>
              </button>
            ) : null}
            {memoryPairs >= 4 ? (
              <Link href={`/app/memory?${memorySearch.toString()}`}>
                <Grid3X3 aria-hidden="true" />
                <span>{text("legacy.2b9a87cb1371", [memoryPairs])}</span>
              </Link>
            ) : null}
          </div>

          <details className="continue-learning-options">
            <summary>
              <Settings2 aria-hidden="true" />
              {text("legacy.ba186cf3adeb")}
            </summary>
            <fieldset>
              <legend>{text("legacy.49540ac1022f")}</legend>
              <div className="continue-rating-options">
                {(Object.keys(ratingLabels) as ReviewRating[]).map((rating) => (
                  <label key={rating}>
                    <input
                      type="checkbox"
                      checked={ratings.includes(rating)}
                      onChange={() =>
                        onRatingsChange(toggleContinueRating(ratings, rating))
                      }
                    />
                    <span>{text(ratingLabels[rating])}</span>
                    <small>{counts[rating]}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>

          {!newCount && !repeatBatchCount ? (
            <span className="continue-learning-status" role="status">
              {text("legacy.d9adee9968cf")}
            </span>
          ) : null}
        </>
      )}
    </section>
  );
}
