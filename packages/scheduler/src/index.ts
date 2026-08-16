import {
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
} from "ts-fsrs";
import type { Card as FsrsCard, Grade } from "ts-fsrs";

import { cardStateSchema } from "@flashcards/domain";
import type { CardState, ReviewRating } from "@flashcards/domain";

export {
  buildStudyQueue,
  limitStudyQueue,
  type StudyQueueCandidate,
  type StudyQueueOptions,
  type StudyQueuePriority,
} from "./study-order.js";

export const schedulerVersion = "ts-fsrs@5.4.1";
export const defaultParameters = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true,
});

const ratingMap: Record<ReviewRating, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};

const stateMap: Record<CardState["learningState"], State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

const reverseStateMap: Record<number, CardState["learningState"]> = {
  [State.New]: "NEW",
  [State.Learning]: "LEARNING",
  [State.Review]: "REVIEW",
  [State.Relearning]: "RELEARNING",
};

export const emptyCardState = (now = new Date()): CardState => ({
  due: now.toISOString(),
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  learningState: "NEW",
  lastReview: null,
});

const toFsrsCard = (state: CardState): FsrsCard => {
  if (state.learningState === "NEW") {
    return createEmptyCard(new Date(state.due));
  }

  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    reps: state.reps,
    lapses: state.lapses,
    state: stateMap[state.learningState],
    last_review: state.lastReview ? new Date(state.lastReview) : undefined,
    learning_steps: 0,
  };
};

const fromFsrsCard = (card: FsrsCard): CardState =>
  cardStateSchema.parse({
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learningState: reverseStateMap[card.state],
    lastReview: card.last_review?.toISOString() ?? null,
  });

export const previewRatings = (
  state: CardState,
  reviewedAt: Date,
): Record<ReviewRating, CardState> => {
  const result = fsrs(defaultParameters).repeat(toFsrsCard(state), reviewedAt);
  return {
    AGAIN: fromFsrsCard(result[Rating.Again].card),
    HARD: fromFsrsCard(result[Rating.Hard].card),
    GOOD: fromFsrsCard(result[Rating.Good].card),
    EASY: fromFsrsCard(result[Rating.Easy].card),
  };
};

export const applyRating = (
  state: CardState,
  rating: ReviewRating,
  reviewedAt: Date,
): CardState =>
  fromFsrsCard(
    fsrs(defaultParameters).next(
      toFsrsCard(state),
      reviewedAt,
      ratingMap[rating],
    ).card,
  );
