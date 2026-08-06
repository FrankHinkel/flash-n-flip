import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";
import { reviewEventSchema, syncMutationSchema } from "@flashcards/domain";
import { emptyCardState, previewRatings } from "@flashcards/scheduler";

import {
  applySyncPage,
  cacheContinuedStudyCards,
  cacheDeckDetail,
  cacheDecks,
  cacheDueCards,
  cacheMedia,
  cacheProfile,
  cacheXefjordCrossLanguageDecks,
  cacheXefjordCrossLanguagePair,
  clearOfflineData,
  closeOfflineDatabase,
  getSyncCursor,
  getCachedDeckDetail,
  getCachedDecks,
  getCachedContinuedStudyCards,
  getCachedDueCards,
  getCachedMedia,
  getCachedProfile,
  getCachedXefjordCrossLanguageDecks,
  getCachedXefjordCrossLanguagePair,
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

describe("offline account content", () => {
  afterEach(async () => {
    await clearOfflineData();
  });

  it("keeps deck order, details, profile, and media across a database reopen", async () => {
    const summary = {
      id: "deck-1",
      title: "Spanish",
    } as Parameters<typeof cacheDecks>[0][number];
    const detail = {
      ...summary,
      cards: [{ id: "card-1", deckId: summary.id }],
    } as unknown as Parameters<typeof cacheDeckDetail>[0];
    const profile = {
      displayName: "Frank",
      email: "frank@example.test",
      locale: "de" as const,
      passwordChangeRequired: false,
    };
    const media = new Blob(["offline image"], { type: "image/png" });

    await cacheDecks([summary]);
    await cacheDeckDetail(detail);
    await cacheProfile(profile);
    await cacheMedia("media-1", media);
    await closeOfflineDatabase();

    await expect(getCachedDecks()).resolves.toEqual([summary]);
    await expect(getCachedDeckDetail(summary.id)).resolves.toEqual(detail);
    await expect(getCachedProfile()).resolves.toEqual(profile);
    const restoredMedia = await getCachedMedia("media-1");
    expect(await restoredMedia?.text()).toBe("offline image");
  });

  it("does not erase account metadata or the sync cursor while refreshing all due cards", async () => {
    const profile = {
      displayName: "Frank",
      email: "frank@example.test",
      locale: "de" as const,
      passwordChangeRequired: false,
    };
    await cacheProfile(profile);
    await applySyncPage({ cursor: 4, changes: [] });
    await cacheDueCards([due("card-1", "deck-1")]);

    await expect(getCachedProfile()).resolves.toEqual(profile);
    await expect(getSyncCursor()).resolves.toBe(4);
    await expect(getCachedDueCards()).resolves.toEqual([
      due("card-1", "deck-1"),
    ]);
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

  it("keeps a virtual Xefjord pair and its review metadata across a restart", async () => {
    const source = {
      id: "019d2000-0000-7000-8000-000000000010",
      collectionDeckId: "019d2000-0000-7000-8000-000000000012",
      title: "German",
      locale: "de",
    };
    const target = {
      id: "019d2000-0000-7000-8000-000000000011",
      collectionDeckId: source.collectionDeckId,
      title: "Icelandic",
      locale: "is",
    };
    const pair = {
      source,
      target,
      views: {
        sourceToTarget: {
          mode: "SOURCE_TO_TARGET" as const,
          cardCount: 167,
          reviewedCardCount: 1,
        },
        targetToSource: {
          mode: "TARGET_TO_SOURCE" as const,
          cardCount: 167,
          reviewedCardCount: 0,
        },
        mixed: {
          mode: "MIXED" as const,
          cardCount: 334,
          reviewedCardCount: 1,
        },
      },
    };
    const queued = {
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
      virtualCard: {
        kind: "XEFJORD_CROSS_LANGUAGE_V1" as const,
        questionDeckId: source.id,
        answerDeckId: target.id,
        matchKey: "a".repeat(64),
      },
    };
    const virtualDue = {
      ...due("virtual-card", source.collectionDeckId),
      virtualContent: {
        questionEnglish: {
          blocks: [
            { type: "text" as const, text: "Night", marks: { italic: true } },
          ],
        },
        answerEnglish: {
          blocks: [
            { type: "text" as const, text: "Night", marks: { italic: true } },
          ],
        },
      },
    } as DueCard;

    await cacheXefjordCrossLanguageDecks([source, target]);
    await cacheXefjordCrossLanguagePair(pair);
    await cacheDueCards([virtualDue], "xefjord-with-english");
    await queueReview(queued);
    await closeOfflineDatabase();

    await expect(getCachedXefjordCrossLanguageDecks()).resolves.toEqual([
      source,
      target,
    ]);
    await expect(
      getCachedXefjordCrossLanguagePair(source.id, target.id),
    ).resolves.toEqual(pair);
    await expect(queuedReviews()).resolves.toEqual([queued]);
    await expect(getCachedDueCards("xefjord-with-english")).resolves.toEqual([
      virtualDue,
    ]);
  });

  it("keeps continued-study cards offline and advances their local FSRS projection", async () => {
    const reviewedAt = new Date(review.reviewedAt);
    const initialState = emptyCardState(reviewedAt);
    const candidate = {
      card: { id: review.cardId, deckId: "deck-1" },
      studyMode: "LEARNING",
      lastRating: "HARD",
      state: initialState,
      preview: previewRatings(initialState, reviewedAt),
    } as DueCard;
    const queued = {
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
    };

    await cacheContinuedStudyCards([candidate], "deck-1");
    await queueReview(queued);
    await closeOfflineDatabase();

    const [restored] = await getCachedContinuedStudyCards("deck-1");
    expect(restored).toMatchObject({
      lastRating: "GOOD",
      state: { reps: 1, lastReview: review.reviewedAt },
    });
    await expect(queuedReviews()).resolves.toEqual([queued]);
  });
});
