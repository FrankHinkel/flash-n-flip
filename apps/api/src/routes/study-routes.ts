import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId, ratingSchema, reviewEventSchema } from "@flashcards/domain";
import type { CardState } from "@flashcards/domain";
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
} from "../db/schema.js";

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
    .select({ id: decks.id, parentDeckId: decks.parentDeckId })
    .from(decks)
    .where(and(eq(decks.ownerId, userId), isNull(decks.archivedAt)));
  if (!owned.some((deck) => deck.id === deckId)) {
    throw Object.assign(new Error("Deck not found"), { statusCode: 404 });
  }
  if (!includeDescendants) return [deckId];
  const selected = new Set([deckId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const deck of owned) {
      if (
        deck.parentDeckId &&
        selected.has(deck.parentDeckId) &&
        !selected.has(deck.id)
      ) {
        selected.add(deck.id);
        changed = true;
      }
    }
  }
  return [...selected];
};

export const registerStudyRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/study/due", { preHandler: authenticate }, async (request) => {
    const query = z
      .object({
        deckId: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(200),
        includeAll: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
      })
      .parse(request.query);
    const now = new Date();
    const privateCards = await db
      .select({ card: cards })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deckId))
      .where(
        and(
          eq(decks.ownerId, request.user.id),
          isNull(decks.archivedAt),
          eq(cards.suspended, false),
          query.deckId ? eq(cards.deckId, query.deckId) : undefined,
        ),
      );
    const subscribedCards = await db
      .select({ card: revisionCards })
      .from(revisionCards)
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
      .where(query.deckId ? eq(revisionCards.deckId, query.deckId) : undefined);
    const available = [
      ...privateCards.map(({ card }) => card),
      ...subscribedCards.map(({ card }) => ({
        id: card.id,
        deckId: card.deckId,
        noteId: card.sourceCardId,
        templateId: null,
        front: card.front,
        back: card.back,
        translations: {},
        suspended: false,
        version: 1,
        createdAt: card.createdAt,
        updatedAt: card.createdAt,
      })),
    ];
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
                  available.map((card) => card.id),
                ),
              ),
            )
        : [];
    const progressByCard = new Map(
      progressRows.map((progress) => [progress.cardId, progress]),
    );
    return available
      .map((card) => ({
        card,
        progress: progressByCard.get(card.id),
      }))
      .filter(
        ({ progress }) =>
          query.includeAll ||
          !progress ||
          progress.due.getTime() <= now.getTime(),
      )
      .sort(
        (left, right) =>
          (left.progress?.due.getTime() ?? 0) -
          (right.progress?.due.getTime() ?? 0),
      )
      .slice(0, query.limit)
      .map(({ card, progress }) => {
        const state = progressToState(progress, now);
        return { card, state, preview: previewRatings(state, now) };
      });
  });

  app.get(
    "/study/confidence",
    { preHandler: authenticate },
    async (request) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.query);
      const deckCards = await db
        .select({ id: cards.id })
        .from(cards)
        .innerJoin(decks, eq(decks.id, cards.deckId))
        .where(
          and(
            eq(cards.deckId, deckId),
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
      .where(inArray(cards.deckId, deckIds));
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
      return { duplicate: true, event: existing };
    }

    const [privateCard] = await db
      .select({ id: cards.id })
      .from(cards)
      .innerJoin(decks, eq(decks.id, cards.deckId))
      .where(
        and(eq(cards.id, input.cardId), eq(decks.ownerId, request.user.id)),
      )
      .limit(1);
    const [subscribedCard] = privateCard
      ? []
      : await db
          .select({ id: revisionCards.id })
          .from(revisionCards)
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
    });
    return { duplicate: false, event };
  });
};
