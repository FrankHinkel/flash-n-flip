"use client";

import { Grid3X3, Plus, RotateCcw, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

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

const ratingLabels: Record<ReviewRating, [string, string]> = {
  AGAIN: ["Again", "Nochmal"],
  HARD: ["Hard", "Schwer"],
  GOOD: ["Good", "Gut"],
  EASY: ["Easy", "Leicht"],
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
  const [preferredMemoryPairs, setPreferredMemoryPairs] = useState(6);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 700px)");
    const update = () => setPreferredMemoryPairs(media.matches ? 8 : 6);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
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
  const memoryPairs =
    memoryPairCount >= preferredMemoryPairs
      ? preferredMemoryPairs
      : memoryPairCount >= 6
        ? 6
        : memoryPairCount >= 4
          ? 4
          : 0;
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
          <span className="eyebrow">{text("In the flow", "Im Flow")}</span>
          <h2 id="continue-learning-heading">
            {text("Keep studying", "Weiterlernen")}
          </h2>
        </div>
      </div>

      {loading ? (
        <span className="continue-learning-status" role="status">
          <RotateCcw className="spin" aria-hidden="true" />
          {text("Preparing choices …", "Möglichkeiten werden vorbereitet …")}
        </span>
      ) : error ? (
        <span className="continue-learning-status" role="alert">
          {text(
            "The additional learning choices could not be loaded.",
            "Die zusätzlichen Lernmöglichkeiten konnten nicht geladen werden.",
          )}
        </span>
      ) : (
        <>
          <div className="continue-learning-actions">
            {newCount > 0 ? (
              <button type="button" onClick={onExtraNew}>
                <Plus aria-hidden="true" />
                <span>
                  {text(`${newCount} new cards`, `${newCount} neue Karten`)}
                </span>
              </button>
            ) : null}
            {repeatBatchCount > 0 ? (
              <button type="button" onClick={onPractice}>
                <RotateCcw aria-hidden="true" />
                <span>
                  {repeatCount > continueStudyBatchSize &&
                  !repeatWindowIsBounded
                    ? text(
                        `${repeatBatchCount} of ${repeatCount} cards to review`,
                        `${repeatBatchCount} von ${repeatCount} Karten wiederholen`,
                      )
                    : text(
                        `${repeatBatchCount} cards to review`,
                        `${repeatBatchCount} Karten wiederholen`,
                      )}
                </span>
              </button>
            ) : null}
            {memoryPairs >= 4 ? (
              <Link href={`/app/memory?${memorySearch.toString()}`}>
                <Grid3X3 aria-hidden="true" />
                <span>
                  {text(
                    `Memory · ${memoryPairs} pairs`,
                    `Memory · ${memoryPairs} Paare`,
                  )}
                </span>
              </Link>
            ) : null}
          </div>

          <details className="continue-learning-options">
            <summary>
              <Settings2 aria-hidden="true" />
              {text("Adjust selection", "Auswahl anpassen")}
            </summary>
            <fieldset>
              <legend>
                {text("By last rating", "Nach letzter Einstufung")}
              </legend>
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
                    <span>{text(...ratingLabels[rating])}</span>
                    <small>{counts[rating]}</small>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>

          {!newCount && !repeatBatchCount ? (
            <span className="continue-learning-status" role="status">
              {text(
                "No matching cards are available. Adjust the selection or choose decks.",
                "Es sind keine passenden Karten verfügbar. Passe die Auswahl an oder wähle Lernsets.",
              )}
            </span>
          ) : null}
          <Link className="continue-learning-decks" href="/app/decks">
            {text("Choose decks", "Decks auswählen")}
          </Link>
        </>
      )}
    </section>
  );
}
