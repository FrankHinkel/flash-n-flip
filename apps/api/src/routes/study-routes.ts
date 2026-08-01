import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createId,
  deckDescendantIds,
  hasDeveloperReferenceTag,
  ratingSchema,
  reviewEventSchema,
  syncMutationSchema,
} from "@flashcards/domain";
import type { CardState, ReviewEvent, SyncMutation } from "@flashcards/domain";
import {
  applyRating,
  defaultParameters,
  emptyCardState,
  previewRatings,
  schedulerVersion,
} from "@flashcards/scheduler";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import {
  cardProgress,
  cards,
  decks,
  publications,
  revisionCards,
  reviewEvents,
  studyResetCards,
  studyResets,
  subscriptions,
  syncMutations,
} from "../db/schema.js";
import { filterStudyVisibleDecks } from "../services/study-deck-visibility.js";
import { buildStudyQueue, limitStudyQueue } from "../services/study-order.js";

const progressToState = (
  progress: typeof cardProgress.$inferSelect | undefined,
  now: Date,
): CardState =>
  progress
    ? {
        due: progress.due.toISOString(),
        stability: Number(progress.stability),
        difficulty: Number(progress.difficulty),
        elapsedDays: progress.elapsedDays,
        scheduledDays: progress.scheduledDays,
        reps: progress.reps,
        lapses: progress.lapses,
        learningState: progress.state,
        lastReview: progress.lastReview?.toISOString() ?? null,
      }
    : emptyCardState(now);

export const createReviewSyncMutation = (
  event: ReviewEvent,
  createdAt: string,
): SyncMutation =>
  syncMutationSchema.parse({
    mutationId: event.mutationId,
    entityId: event.id,
    entityType: "REVIEW",
    operation: "UPSERT",
    baseVersion: null,
    payload: event,
    createdAt,
  });

const persistedReviewEvent = (
  event: typeof reviewEvents.$inferSelect,
): ReviewEvent =>
  reviewEventSchema.parse({
    id: event.id,
    mutationId: event.mutationId,
    userId: event.userId,
    cardId: event.cardId,
    rating: event.rating,
    reviewedAt: event.reviewedAt.toISOString(),
    timezone: event.timezone,
    schedulerVersion: event.schedulerVersion,
    parameters: event.parameters,
    before: event.before,
    after: event.after,
  });

export const securelyRecognizedCardIds = (
  events: Array<{
    cardId: string;
    rating: "AGAIN" | "HARD" | "GOOD" | "EASY";
    reviewedAt: Date;
    createdAt: Date;
  }>,
): string[] => {
  const latestByCard = new Map<
    string,
    {
      rating: "AGAIN" | "HARD" | "GOOD" | "EASY";
      reviewedAt: Date;
      createdAt: Date;
    }
  >();
  for (const event of events) {
    const current = latestByCard.get(event.cardId);
    if (
      !current ||
      event.reviewedAt > current.reviewedAt ||
      (event.reviewedAt.getTime() === current.reviewedAt.getTime() &&
        event.createdAt > current.createdAt)
    ) {
      latestByCard.set(event.cardId, event);
    }
  }
  return [...latestByCard]
    .filter(([, event]) => event.rating === "GOOD" || event.rating === "EASY")
    .map(([cardId]) => cardId);
};

const ownedDeckScope = async (
  userId: string,
  deckId: string,
  includeDescendants: boolean,
): Promise<string[]> => {
  const owned = await db
    .select({
      id: decks.id,
      parentDeckId: decks.parentDeckId,
      hiddenAt: decks.hiddenAt,
    })
    .from(decks)
    .where(and(eq(decks.ownerId, userId), isNull(decks.archivedAt)));
  return studyDeckScope(
    filterStudyVisibleDecks(owned),
    deckId,
    includeDescendants,
  );
};

export const studyDeckScope = (
  visibleOwnedDecks: Array<{ id: string; parentDeckId: string | null }>,
  deckId: string,
  includeDescendants: boolean,
): string[] => {
  if (!visibleOwnedDecks.some((deck) => deck.id === deckId)) {
    throw Object.assign(new Error("Deck not found"), { statusCode: 404 });
  }
  return includeDescendants
    ? [...deckDescendantIds(visibleOwnedDecks, deckId)]
    : [deckId];
};

export const registerStudyRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/study/due", { preHandler: authenticate }, async (request) => {
    const query = z
      .object({
        deckId: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(1000),
        includeAll: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
      })
      .parse(request.query);
    const now = new Date();
    const selectedDeckIds = query.deckId
      ? await ownedDeckScope(request.user.id, query.deckId, true)
      : null;
    const allVisiblePrivateDeckIds = query.deckId
      ? null
      : filterStudyVisibleDecks(
          await db
            .select({
              id: decks.id,
              parentDeckId: decks.parentDeckId,
              hiddenAt: decks.hiddenAt,
            })
            .from(decks)
            .where(
              and(eq(decks.ownerId, request.user.id), isNull(decks.archivedAt)),
            ),
        ).map((deck) => deck.id);
    const privateCards = await db
      .select({
        card: cards,
        deckTags: decks.tags,
        studyOrder: decks.studyOrder,
      })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deckId))
      .where(
        and(
          eq(decks.ownerId, request.user.id),
          isNull(decks.archivedAt),
          allVisiblePrivateDeckIds
            ? inArray(cards.deckId, allVisiblePrivateDeckIds)
            : undefined,
          eq(cards.suspended, false),
          selectedDeckIds ? inArray(cards.deckId, selectedDeckIds) : undefined,
        ),
      );
    const subscribedCards = await db
      .select({
        card: revisionCards,
        deckTags: decks.tags,
        studyOrder: decks.studyOrder,
      })
      .from(revisionCards)
      .innerJoin(decks, eq(decks.id, revisionCards.deckId))
      .innerJoin(
        subscriptions,
        and(
          eq(subscriptions.revisionId, revisionCards.revisionId),
          eq(subscriptions.userId, request.user.id),
        ),
      )
      .innerJoin(
        publications,
        and(
          eq(publications.id, subscriptions.publicationId),
          eq(publications.status, "PUBLISHED"),
        ),
      )
      .where(
        selectedDeckIds
          ? inArray(revisionCards.deckId, selectedDeckIds)
          : undefined,
      );
    const availableCandidates = [
      ...subscribedCards.map(({ card, deckTags, studyOrder }) => ({
        deckTags,
        studyOrder:
          studyOrder === "SEQUENTIAL"
            ? ("SEQUENTIAL" as const)
            : ("SCHEDULED" as const),
        card: {
          id: card.id,
          deckId: card.deckId,
          noteId: card.sourceCardId,
          templateId: null,
          front: card.front,
          back: card.back,
          questionLocale: card.questionLocale,
          answerLocale: card.answerLocale,
          translations: {},
          kind:
            card.kind === "EXPLANATION"
              ? ("EXPLANATION" as const)
              : ("QUESTION" as const),
          position: card.position,
          linkedToPrevious: card.linkedToPrevious,
          suspended: false,
          version: 1,
          createdAt: card.createdAt,
          updatedAt: card.createdAt,
        },
      })),
      ...privateCards.map(({ card, deckTags, studyOrder }) => ({
        deckTags,
        card: {
          ...card,
          kind:
            card.kind === "EXPLANATION"
              ? ("EXPLANATION" as const)
              : ("QUESTION" as const),
        },
        studyOrder:
          studyOrder === "SEQUENTIAL"
            ? ("SEQUENTIAL" as const)
            : ("SCHEDULED" as const),
      })),
    ];
    const selectedDeckTags = query.deckId
      ? (
          await db
            .select({ tags: decks.tags })
            .from(decks)
            .where(
              and(
                eq(decks.id, query.deckId),
                eq(decks.ownerId, request.user.id),
              ),
            )
            .limit(1)
        )[0]?.tags
      : undefined;
    const referenceBrowsing = hasDeveloperReferenceTag(selectedDeckTags);
    const available = [
      ...new Map(
        availableCandidates.map((candidate) => [candidate.card.id, candidate]),
      ).values(),
    ].filter(
      (candidate) =>
        referenceBrowsing || !hasDeveloperReferenceTag(candidate.deckTags),
    );
    const referenceCardIds = new Set(
      available
        .filter((candidate) => hasDeveloperReferenceTag(candidate.deckTags))
        .map((candidate) => candidate.card.id),
    );
    const progressRows =
      available.length > 0
        ? await db
            .select()
            .from(cardProgress)
            .where(
              and(
                eq(cardProgress.userId, request.user.id),
                inArray(
                  cardProgress.cardId,
                  available.map(({ card }) => card.id),
                ),
              ),
            )
        : [];
    const progressByCard = new Map(
      progressRows.map((progress) => [progress.cardId, progress]),
    );
    const shuffleSeed = [
      request.user.id,
      request.user.sessionId,
      now.toISOString().slice(0, 10),
      query.deckId ?? "all-decks",
      query.includeAll ? "practice-all" : "due",
    ].join(":");
    return limitStudyQueue(
      buildStudyQueue(
        available.map(({ card, studyOrder }) => {
          const progress = progressByCard.get(card.id);
          const isDueReview =
            Boolean(progress) && progress!.due.getTime() <= now.getTime();
          return {
            card,
            studyOrder,
            dueAt: progress?.due.getTime() ?? 0,
            queuePriority: !progress
              ? ("NEW" as const)
              : isDueReview
                ? ("DUE_REVIEW" as const)
                : ("PRACTICE" as const),
            isDueQuestion:
              card.kind === "QUESTION" &&
              (query.includeAll ||
                !progress ||
                progress.due.getTime() <= now.getTime()),
          };
        }),
        {
          shuffleSeed,
          selectedDeckId: query.deckId,
        },
      ),
      query.limit,
    )
      .map(({ card }) => ({
        card,
        studyMode: referenceCardIds.has(card.id)
          ? ("REFERENCE" as const)
          : ("LEARNING" as const),
        progress: progressByCard.get(card.id),
      }))
      .map(({ card, progress, studyMode }) => {
        const state = progressToState(progress, now);
        return {
          card,
          studyMode,
          state,
          preview: previewRatings(state, now),
        };
      });
  });

  app.get(
    "/study/confidence",
    { preHandler: authenticate },
    async (request) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.query);
      const deckIds = await ownedDeckScope(request.user.id, deckId, true);
      const deckCards = await db
        .select({ id: cards.id })
        .from(cards)
        .innerJoin(decks, eq(decks.id, cards.deckId))
        .where(
          and(
            inArray(cards.deckId, deckIds),
            eq(decks.ownerId, request.user.id),
            isNull(decks.archivedAt),
          ),
        );
      if (deckCards.length === 0) {
        return { securelyRecognizedCardIds: [] };
      }
      const events = await db
        .select({
          cardId: reviewEvents.cardId,
          rating: reviewEvents.rating,
          reviewedAt: reviewEvents.reviewedAt,
          createdAt: reviewEvents.createdAt,
        })
        .from(reviewEvents)
        .where(
          and(
            eq(reviewEvents.userId, request.user.id),
            inArray(
              reviewEvents.cardId,
              deckCards.map((card) => card.id),
            ),
          ),
        )
        .orderBy(desc(reviewEvents.reviewedAt), desc(reviewEvents.createdAt));
      const resetRows = await db
        .select({
          cardId: studyResetCards.cardId,
          resetAt: studyResets.resetAt,
        })
        .from(studyResetCards)
        .innerJoin(studyResets, eq(studyResets.id, studyResetCards.resetId))
        .where(
          and(
            eq(studyResets.userId, request.user.id),
            inArray(
              studyResetCards.cardId,
              deckCards.map((card) => card.id),
            ),
          ),
        );
      const latestResetByCard = new Map<string, Date>();
      for (const reset of resetRows) {
        const current = latestResetByCard.get(reset.cardId);
        if (!current || reset.resetAt > current) {
          latestResetByCard.set(reset.cardId, reset.resetAt);
        }
      }
      return {
        securelyRecognizedCardIds: securelyRecognizedCardIds(
          events.filter((event) => {
            const resetAt = latestResetByCard.get(event.cardId);
            return !resetAt || event.reviewedAt > resetAt;
          }),
        ),
      };
    },
  );

  app.post("/study/reset", { preHandler: authenticate }, async (request) => {
    const input = z
      .object({
        mutationId: z.uuid(),
        deckId: z.uuid(),
        includeDescendants: z.boolean().default(false),
      })
      .parse(request.body);
    const [existing] = await db
      .select()
      .from(studyResets)
      .where(
        and(
          eq(studyResets.userId, request.user.id),
          eq(studyResets.mutationId, input.mutationId),
        ),
      )
      .limit(1);
    if (existing) {
      const [result] = await db
        .select({ resetCardCount: count(studyResetCards.cardId) })
        .from(studyResetCards)
        .where(eq(studyResetCards.resetId, existing.id));
      return {
        duplicate: true,
        resetCardCount: result?.resetCardCount ?? 0,
        resetAt: existing.resetAt.toISOString(),
      };
    }
    const deckIds = await ownedDeckScope(
      request.user.id,
      input.deckId,
      input.includeDescendants,
    );
    const selectedCards = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(inArray(cards.deckId, deckIds), eq(cards.kind, "QUESTION")));
    const resetId = createId();
    const resetAt = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(studyResets).values({
        id: resetId,
        mutationId: input.mutationId,
        userId: request.user.id,
        deckId: input.deckId,
        includeDescendants: input.includeDescendants,
        resetAt,
      });
      if (selectedCards.length) {
        await tx
          .insert(studyResetCards)
          .values(selectedCards.map((card) => ({ resetId, cardId: card.id })));
        await tx.delete(cardProgress).where(
          and(
            eq(cardProgress.userId, request.user.id),
            inArray(
              cardProgress.cardId,
              selectedCards.map((card) => card.id),
            ),
          ),
        );
      }
    });
    return {
      duplicate: false,
      resetCardCount: selectedCards.length,
      resetAt: resetAt.toISOString(),
    };
  });

  app.post("/study/review", { preHandler: authenticate }, async (request) => {
    const input = z
      .object({
        mutationId: z.uuid(),
        cardId: z.uuid(),
        rating: ratingSchema,
        reviewedAt: z.string().datetime(),
        timezone: z.string().min(1).max(100),
      })
      .parse(request.body);
    const reviewedAt = new Date(input.reviewedAt);

    const [existing] = await db
      .select()
      .from(reviewEvents)
      .where(
        and(
          eq(reviewEvents.userId, request.user.id),
          eq(reviewEvents.mutationId, input.mutationId),
        ),
      )
      .limit(1);
    if (existing) {
      const event = persistedReviewEvent(existing);
      const mutation = createReviewSyncMutation(
        event,
        existing.createdAt.toISOString(),
      );
      await db
        .insert(syncMutations)
        .values({
          userId: request.user.id,
          mutationId: mutation.mutationId,
          payload: mutation as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing();
      return { duplicate: true, event };
    }

    const [privateCard] = await db
      .select({ id: cards.id, kind: cards.kind, deckTags: decks.tags })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deckId))
      .where(
        and(eq(cards.id, input.cardId), eq(decks.ownerId, request.user.id)),
      )
      .limit(1);
    const [subscribedCard] = privateCard
      ? []
      : await db
          .select({
            id: revisionCards.id,
            kind: revisionCards.kind,
            deckTags: decks.tags,
          })
          .from(revisionCards)
          .innerJoin(decks, eq(decks.id, revisionCards.deckId))
          .innerJoin(
            subscriptions,
            and(
              eq(subscriptions.revisionId, revisionCards.revisionId),
              eq(subscriptions.userId, request.user.id),
            ),
          )
          .innerJoin(
            publications,
            and(
              eq(publications.id, subscriptions.publicationId),
              eq(publications.status, "PUBLISHED"),
            ),
          )
          .where(eq(revisionCards.id, input.cardId))
          .limit(1);
    if (!privateCard && !subscribedCard) {
      throw Object.assign(new Error("Card not found"), { statusCode: 404 });
    }
    if ((privateCard ?? subscribedCard)?.kind === "EXPLANATION") {
      throw Object.assign(new Error("Explanations cannot be rated"), {
        statusCode: 422,
      });
    }
    if (hasDeveloperReferenceTag((privateCard ?? subscribedCard)?.deckTags)) {
      throw Object.assign(new Error("References cannot be rated"), {
        statusCode: 422,
      });
    }

    const [progress] = await db
      .select()
      .from(cardProgress)
      .where(
        and(
          eq(cardProgress.userId, request.user.id),
          eq(cardProgress.cardId, input.cardId),
        ),
      )
      .limit(1);
    const before = progressToState(progress, reviewedAt);
    const after = applyRating(before, input.rating, reviewedAt);
    const parameters = [...defaultParameters.w];
    const event = reviewEventSchema.parse({
      id: createId(),
      mutationId: input.mutationId,
      userId: request.user.id,
      cardId: input.cardId,
      reviewedAt: input.reviewedAt,
      timezone: input.timezone,
      rating: input.rating,
      schedulerVersion,
      parameters,
      before,
      after,
    });
    const mutation = createReviewSyncMutation(event, new Date().toISOString());

    await db.transaction(async (tx) => {
      await tx.insert(reviewEvents).values({
        ...event,
        reviewedAt,
        before: event.before,
        after: event.after,
      });
      await tx
        .insert(cardProgress)
        .values({
          userId: request.user.id,
          cardId: input.cardId,
          due: new Date(after.due),
          stability: String(after.stability),
          difficulty: String(after.difficulty),
          elapsedDays: after.elapsedDays,
          scheduledDays: after.scheduledDays,
          reps: after.reps,
          lapses: after.lapses,
          state: after.learningState,
          lastReview: after.lastReview ? new Date(after.lastReview) : null,
          schedulerVersion,
          parameters,
        })
        .onConflictDoUpdate({
          target: [cardProgress.userId, cardProgress.cardId],
          set: {
            due: new Date(after.due),
            stability: String(after.stability),
            difficulty: String(after.difficulty),
            elapsedDays: after.elapsedDays,
            scheduledDays: after.scheduledDays,
            reps: after.reps,
            lapses: after.lapses,
            state: after.learningState,
            lastReview: after.lastReview ? new Date(after.lastReview) : null,
            schedulerVersion,
            parameters,
            updatedAt: new Date(),
          },
        });
      await tx
        .insert(syncMutations)
        .values({
          userId: request.user.id,
          mutationId: mutation.mutationId,
          payload: mutation as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing();
    });
    return { duplicate: false, event };
  });
};
