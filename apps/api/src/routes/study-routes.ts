import { and, eq, inArray, isNull } from "drizzle-orm";
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

export const registerStudyRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/study/due", { preHandler: authenticate }, async (request) => {
    const query = z
      .object({
        deckId: z.uuid().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
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
        ({ progress }) => !progress || progress.due.getTime() <= now.getTime(),
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
