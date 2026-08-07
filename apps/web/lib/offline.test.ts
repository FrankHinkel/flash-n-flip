import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type { DueCard } from "@flashcards/api-client";
import { reviewEventSchema, syncMutationSchema } from "@flashcards/domain";
import { emptyCardState, previewRatings } from "@flashcards/scheduler";

import {
  applyPeerMutationBatch,
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
  commitTransferredDecks,
  getSyncCursor,
  getCachedDeckDetail,
  getCachedDecks,
  getCachedContinuedStudyCards,
  getCachedDueCards,
  getCachedMedia,
  getCachedProfile,
  getPeerMutations,
  getReplicaWatermarks,
  getCachedXefjordCrossLanguageDecks,
  getCachedXefjordCrossLanguagePair,
  orderCachedDueCards,
  permanentlyDeleteLocallyTransferredDecks,
  queueReview,
  queuedReviews,
  reviewEventFromSyncChange,
  selectCachedDueCards,
  storedReviewEvents,
  storeLocalDeviceIdentity,
  setLocallyTransferredDecksArchived,
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

  it("archives, restores, and permanently deletes received decks locally", async () => {
    const mediaId = "019d4000-0000-7000-8000-000000000001";
    const makeDeck = (suffix: string) =>
      ({
        id: `019d4000-0000-7000-8000-0000000000${suffix}`,
        parentDeckId: null,
        title: `Received ${suffix}`,
        description: "",
        language: "en",
        contentLocales: ["en"],
        defaultContentLocale: "en",
        sourceLocale: "en",
        targetLocale: "de",
        studyOrder: "SCHEDULED",
        protectionMode: "STANDARD",
        tags: [],
        favorite: false,
        hiddenAt: null,
        archivedAt: null,
        visual: null,
        sourceTemplateKey: null,
        version: 1,
        updatedAt: "2026-08-07T10:00:00.000Z",
        cards: [
          {
            id: `019d4000-0000-7000-8000-0000000001${suffix}`,
            deckId: `019d4000-0000-7000-8000-0000000000${suffix}`,
            noteId: `019d4000-0000-7000-8000-0000000002${suffix}`,
            front: {
              blocks: [{ type: "audio", mediaId, label: "voice.m4a" }],
            },
            back: { blocks: [{ type: "text", text: "Answer" }] },
            translations: {},
            kind: "QUESTION",
            position: 0,
            linkedToPrevious: false,
            version: 1,
            suspended: false,
            createdAt: "2026-08-07T10:00:00.000Z",
            updatedAt: "2026-08-07T10:00:00.000Z",
          },
        ],
      }) as unknown as Parameters<
        typeof commitTransferredDecks
      >[0]["decks"][number];
    const first = makeDeck("02");
    const second = makeDeck("03");
    const transferId = "019d4000-0000-7000-8000-000000000004";
    await commitTransferredDecks({
      decks: [first, second],
      media: new Map([[mediaId, new Blob(["audio"], { type: "audio/mp4" })]]),
      session: {
        id: transferId,
        peerDeviceId: "019d4000-0000-7000-8000-000000000005",
        direction: "RECEIVE",
        state: "COMPLETED",
        manifest: null,
        verifiedBytes: 5,
        verifiedObjects: 2,
        updatedAt: "2026-08-07T10:00:00.000Z",
        error: null,
      },
    });

    const storedFirst = (await getCachedDecks(true, true)).find(
      (deck) => deck.id === first.id,
    );
    const storedSecond = (await getCachedDecks(true, true)).find(
      (deck) => deck.id === second.id,
    );
    expect(storedFirst?.storageBytes).toBe(
      new TextEncoder().encode(JSON.stringify(first)).byteLength + 5,
    );
    expect(storedSecond?.storageBytes).toBe(
      new TextEncoder().encode(JSON.stringify(second)).byteLength + 5,
    );

    await setLocallyTransferredDecksArchived(
      new Set([first.id]),
      "2026-08-07T11:00:00.000Z",
    );
    expect((await getCachedDecks()).map((deck) => deck.id)).toEqual([
      second.id,
    ]);
    expect(
      (await getCachedDecks(true, true)).find((deck) => deck.id === first.id)
        ?.archivedAt,
    ).toBe("2026-08-07T11:00:00.000Z");

    await setLocallyTransferredDecksArchived(new Set([first.id]), null);
    expect((await getCachedDeckDetail(first.id))?.archivedAt).toBeNull();

    await permanentlyDeleteLocallyTransferredDecks(new Set([first.id]));
    await expect(getCachedDeckDetail(first.id)).resolves.toBeNull();
    expect(await getCachedMedia(mediaId)).not.toBeNull();

    await permanentlyDeleteLocallyTransferredDecks(new Set([second.id]));
    await expect(getCachedDeckDetail(second.id)).resolves.toBeNull();
    await expect(getCachedMedia(mediaId)).resolves.toBeNull();
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

  it("keeps a local-transfer review local and advances its durable due state", async () => {
    const reviewedAt = new Date(review.reviewedAt);
    const state = emptyCardState(reviewedAt);
    await cacheDueCards([
      {
        card: { id: review.cardId, deckId: "local-deck" },
        studyMode: "LEARNING",
        lastRating: null,
        state,
        preview: previewRatings(state, reviewedAt),
      } as DueCard,
    ]);

    await queueReview({
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
      localOnly: true,
    });
    await closeOfflineDatabase();

    await expect(queuedReviews()).resolves.toEqual([]);
    const [stored] = await getCachedDueCards();
    expect(stored).toMatchObject({
      lastRating: "GOOD",
      state: { reps: 1, lastReview: review.reviewedAt },
    });
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

  it("journals an offline review once for direct peer synchronization", async () => {
    const identityId = "019d2000-0000-7000-8000-000000000020";
    const keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    await storeLocalDeviceIdentity({
      id: identityId,
      displayName: "Browser",
      platform: "WEB",
      publicKey: "p".repeat(64),
      privateKey: keyPair.privateKey,
      createdAt: review.reviewedAt,
    });
    await cacheProfile({
      id: review.userId,
      displayName: "Frank",
      email: "frank@example.test",
      locale: "de",
      passwordChangeRequired: false,
    });
    const initialState = emptyCardState(new Date(review.reviewedAt));
    await cacheContinuedStudyCards(
      [
        {
          card: { id: review.cardId, deckId: "deck-1" },
          studyMode: "LEARNING",
          lastRating: null,
          state: initialState,
          preview: previewRatings(initialState, new Date(review.reviewedAt)),
        } as DueCard,
      ],
      "deck-1",
    );

    const queued = {
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
    };
    await queueReview(queued);

    await expect(getReplicaWatermarks()).resolves.toEqual({ [identityId]: 1 });
    const mutations = await getPeerMutations();
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      mutationId: review.mutationId,
      entityType: "REVIEW",
      originDeviceId: identityId,
      originSequence: 1,
      payload: { event: { mutationId: review.mutationId } },
    });

    await clearOfflineData();
    await applyPeerMutationBatch(mutations);
    await applyPeerMutationBatch(mutations);

    await expect(queuedReviews()).resolves.toEqual([queued]);
    await expect(getReplicaWatermarks()).resolves.toEqual({ [identityId]: 1 });
  });

  it("rejects a peer mutation whose payload no longer matches its hash", async () => {
    const identityId = "019d2000-0000-7000-8000-000000000021";
    const keyPair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    await storeLocalDeviceIdentity({
      id: identityId,
      displayName: "Browser",
      platform: "WEB",
      publicKey: "q".repeat(64),
      privateKey: keyPair.privateKey,
      createdAt: review.reviewedAt,
    });
    await cacheProfile({
      id: review.userId,
      displayName: "Frank",
      email: "frank@example.test",
      locale: "de",
      passwordChangeRequired: false,
    });
    const initialState = emptyCardState(new Date(review.reviewedAt));
    await cacheContinuedStudyCards(
      [
        {
          card: { id: review.cardId, deckId: "deck-1" },
          studyMode: "LEARNING",
          lastRating: null,
          state: initialState,
          preview: previewRatings(initialState, new Date(review.reviewedAt)),
        } as DueCard,
      ],
      "deck-1",
    );
    await queueReview({
      mutationId: review.mutationId,
      cardId: review.cardId,
      rating: review.rating,
      reviewedAt: review.reviewedAt,
      timezone: review.timezone,
    });
    const [mutation] = await getPeerMutations();
    expect(mutation).toBeTruthy();
    await clearOfflineData();

    await expect(
      applyPeerMutationBatch([
        {
          ...mutation!,
          payload: {
            ...(mutation!.payload as object),
            event: {
              ...(mutation!.payload as { event: object }).event,
              rating: "AGAIN",
            },
          },
        },
      ]),
    ).rejects.toThrow("payload hash does not match");
    await expect(queuedReviews()).resolves.toEqual([]);
  });
});
