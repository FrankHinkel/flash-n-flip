import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";
import { reviewEventSchema, syncMutationSchema } from "@flashcards/domain";

import {
  applySyncPage,
  clearOfflineData,
  closeOfflineDatabase,
  getSyncCursor,
  orderCachedDueCards,
  queueReview,
  queuedReviews,
  reviewEventFromSyncChange,
  selectCachedDueCards,
  storedReviewEvents,
  synchronizeReviewProgress,
} from "./offline";

const due = (cardId: string, deckId: string): DueCard =>
  ({
    card: { id: cardId, deckId },
  }) as DueCard;

describe("offline collection study scope", () => {
  const cards = [
    due("root-card", "collection"),
    due("child-card", "child"),
    due("other-card", "other"),
  ];

  it("restores cards from the selected collection and its subdecks", () => {
    expect(
      selectCachedDueCards(cards, "collection", [
        "root-card",
        "child-card",
      ]).map((item) => item.card.id),
    ).toEqual(["root-card", "child-card"]);
  });

  it("falls back to exact deck matching for legacy caches", () => {
    expect(
      selectCachedDueCards(cards, "collection").map((item) => item.card.id),
    ).toEqual(["root-card"]);
  });

  it("restores the server queue order instead of IndexedDB key order", () => {
    expect(
      orderCachedDueCards(cards, ["other-card", "root-card", "child-card"]).map(
        (item) => item.card.id,
      ),
    ).toEqual(["other-card", "root-card", "child-card"]);
  });
});

describe("review progress synchronization", () => {
  const review = reviewEventSchema.parse({
    id: "019d2000-0000-7000-8000-000000000001",
    mutationId: "019d2000-0000-7000-8000-000000000002",
    userId: "019d2000-0000-7000-8000-000000000003",
    cardId: "019d2000-0000-7000-8000-000000000004",
    reviewedAt: "2026-08-01T10:00:00.000Z",
    timezone: "Europe/Berlin",
    rating: "GOOD",
    schedulerVersion: "test-fsrs",
    parameters: [0.4, 0.6],
    before: {
      due: "2026-08-01T10:00:00.000Z",
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      learningState: "NEW",
      lastReview: null,
    },
    after: {
      due: "2026-08-02T10:00:00.000Z",
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 1,
      lapses: 0,
      learningState: "LEARNING",
      lastReview: "2026-08-01T10:00:00.000Z",
    },
  });
  const mutation = syncMutationSchema.parse({
    mutationId: review.mutationId,
    entityId: review.id,
    entityType: "REVIEW",
    operation: "UPSERT",
    baseVersion: null,
    payload: review,
    createdAt: "2026-08-01T10:00:01.000Z",
  });

  afterEach(async () => {
    await clearOfflineData();
  });

  it("accepts a canonical immutable review event", () => {
    expect(reviewEventFromSyncChange({ cursor: 7, mutation })).toEqual(review);
  });

  it("keeps a mismatched review mutation out of the applied review log", () => {
    expect(
      reviewEventFromSyncChange({
        cursor: 8,
        mutation: { ...mutation, entityId: review.cardId },
      }),
    ).toBeNull();
  });

  it("stores the canonical event and cursor idempotently across database reopens", async () => {
    const page = {
      cursor: 7,
      changes: [{ cursor: 7, mutation }],
    };

    await applySyncPage(page);
    await applySyncPage(page);

    await expect(getSyncCursor()).resolves.toBe(7);
    await expect(storedReviewEvents()).resolves.toEqual([review]);
  });

  it("rolls back review application when the pulled cursor order is invalid", async () => {
    await expect(
      applySyncPage({
        cursor: 8,
        changes: [
          { cursor: 8, mutation },
          { cursor: 7, mutation },
        ],
      }),
    ).rejects.toThrow("Sync changes are not strictly ordered");

    await expect(getSyncCursor()).resolves.toBe(0);
    await expect(storedReviewEvents()).resolves.toEqual([]);
  });

  it("resumes pulling from the cursor persisted by the preceding sync", async () => {
    const requestedCursors: number[] = [];
    const pull = async (cursor: number) => {
      requestedCursors.push(cursor);
      return cursor === 0
        ? { cursor: 7, changes: [{ cursor: 7, mutation }] }
        : { cursor, changes: [] };
    };

    await synchronizeReviewProgress(pull);
    await synchronizeReviewProgress(pull);

    expect(requestedCursors).toEqual([0, 7]);
    await expect(storedReviewEvents()).resolves.toEqual([review]);
  });

  it("keeps an offline review queued across a database close and reopen", async () => {
    const queued = {
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
    };

    await queueReview(queued);
    await closeOfflineDatabase();

    await expect(queuedReviews()).resolves.toEqual([queued]);
  });
});
