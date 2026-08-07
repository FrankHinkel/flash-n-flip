import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createId,
  deckDescendantIds,
  hasDeveloperReferenceTag,
  hasOptionalPracticeTag,
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
  virtualStudyTargets,
} from "../db/schema.js";
import { filterStudyVisibleDecks } from "../services/study-deck-visibility.js";
import { buildStudyQueue, limitStudyQueue } from "../services/study-order.js";
import {
  createXefjordCrossLanguageCards,
  listXefjordCrossLanguageDecks,
  resolveXefjordCrossLanguageCard,
  resolveXefjordCrossLanguagePair,
  xefjordVirtualCardId,
  xefjordVirtualStudyKind,
} from "../services/xefjord-cross-language.js";

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

export const shouldQueueStudyQuestion = ({
  kind,
  includeAll,
  includeNew,
  dueAt,
  now,
}: {
  kind: "QUESTION" | "EXPLANATION";
  includeAll: boolean;
  includeNew: boolean;
  dueAt: Date | null;
  now: Date;
}): boolean =>
  kind === "QUESTION" &&
  (includeAll ||
    (includeNew && dueAt === null) ||
    Boolean(dueAt && dueAt <= now));

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

export const shouldIncludeStudyDeck = (
  candidateTags: readonly string[] | null | undefined,
  selectedTags: readonly string[] | null | undefined,
): boolean =>
  (hasDeveloperReferenceTag(selectedTags) ||
    !hasDeveloperReferenceTag(candidateTags)) &&
  (hasOptionalPracticeTag(selectedTags) ||
    !hasOptionalPracticeTag(candidateTags));

export const registerStudyRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get(
    "/study/xefjord/languages",
    { preHandler: authenticate },
    async (request) => ({
      languages: await listXefjordCrossLanguageDecks(request.user.id),
    }),
  );

  app.get(
    "/study/xefjord/pair",
    { preHandler: authenticate },
    async (request) => {
      const input = z
        .object({
          sourceDeckId: z.uuid(),
          targetDeckId: z.uuid(),
        })
        .parse(request.query);
      const pair = await resolveXefjordCrossLanguagePair(
        request.user.id,
        input.sourceDeckId,
        input.targetDeckId,
      );
      const sourceToTargetIds = pair.matches.map((match) =>
        xefjordVirtualCardId(pair.source.id, pair.target.id, match.matchKey),
      );
      const targetToSourceIds = pair.matches.map((match) =>
        xefjordVirtualCardId(pair.target.id, pair.source.id, match.matchKey),
      );
      const allIds = [...sourceToTargetIds, ...targetToSourceIds];
      const reviewedRows = allIds.length
        ? await db
            .select({ cardId: cardProgress.cardId })
            .from(cardProgress)
            .where(
              and(
                eq(cardProgress.userId, request.user.id),
                inArray(cardProgress.cardId, allIds),
              ),
            )
        : [];
      const reviewed = new Set(reviewedRows.map((row) => row.cardId));
      const reviewedCount = (ids: string[]) =>
        ids.filter((id) => reviewed.has(id)).length;
      const sharedCount = pair.matches.length;
      return {
        source: pair.source,
        target: pair.target,
        views: {
          sourceToTarget: {
            mode: "SOURCE_TO_TARGET" as const,
            cardCount: sharedCount,
            reviewedCardCount: reviewedCount(sourceToTargetIds),
          },
          targetToSource: {
            mode: "TARGET_TO_SOURCE" as const,
            cardCount: sharedCount,
            reviewedCardCount: reviewedCount(targetToSourceIds),
          },
          mixed: {
            mode: "MIXED" as const,
            cardCount: sharedCount * 2,
            reviewedCardCount: reviewedCount(allIds),
          },
        },
      };
    },
  );

  app.get("/study/due", { preHandler: authenticate }, async (request) => {
    const query = z
      .object({
        deckId: z.uuid().optional(),
        xefjordSourceDeckId: z.uuid().optional(),
        xefjordTargetDeckId: z.uuid().optional(),
        xefjordMode: z
          .enum(["SOURCE_TO_TARGET", "TARGET_TO_SOURCE", "MIXED"])
          .optional(),
        xefjordQuestionEnglish: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
        xefjordAnswerEnglish: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
        limit: z.coerce.number().int().min(1).max(2000).default(1000),
        includeAll: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
        includeNew: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value !== "false"),
      })
      .superRefine((value, context) => {
        const crossFields = [
          value.xefjordSourceDeckId,
          value.xefjordTargetDeckId,
          value.xefjordMode,
        ];
        if (crossFields.some(Boolean) && !crossFields.every(Boolean)) {
          context.addIssue({
            code: "custom",
            message: "A complete Xefjord cross-language selection is required",
          });
        }
      })
      .parse(request.query);
    const now = new Date();
    const crossPair = query.xefjordSourceDeckId
      ? await resolveXefjordCrossLanguagePair(
          request.user.id,
          query.xefjordSourceDeckId,
          query.xefjordTargetDeckId!,
        )
      : null;
    const selectedDeckIds =
      !crossPair && query.deckId
        ? await ownedDeckScope(request.user.id, query.deckId, true)
        : null;
    const allVisiblePrivateDeckIds =
      crossPair || query.deckId
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
                and(
                  eq(decks.ownerId, request.user.id),
                  isNull(decks.archivedAt),
                ),
              ),
          ).map((deck) => deck.id);
    const privateCards = crossPair
      ? []
      : await db
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
              selectedDeckIds
                ? inArray(cards.deckId, selectedDeckIds)
                : undefined,
            ),
          );
    const subscribedCards = crossPair
      ? []
      : await db
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
    const availableCandidates = crossPair
      ? createXefjordCrossLanguageCards(crossPair, query.xefjordMode!, {
          questionEnglish: query.xefjordQuestionEnglish,
          answerEnglish: query.xefjordAnswerEnglish,
        }).map(({ card, virtualCard, virtualContent }) => ({
          card,
          virtualCard,
          virtualContent,
          deckTags: [] as string[],
          studyOrder: "SCHEDULED" as const,
        }))
      : [
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
    const selectedDeckTags =
      !crossPair && query.deckId
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
    ].filter((candidate) =>
      shouldIncludeStudyDeck(candidate.deckTags, selectedDeckTags),
    );
    const referenceCardIds = new Set(
      available
        .filter((candidate) => hasDeveloperReferenceTag(candidate.deckTags))
        .map((candidate) => candidate.card.id),
    );
    const virtualCardsById = new Map(
      available.flatMap((candidate) =>
        "virtualCard" in candidate && candidate.virtualCard
          ? [[candidate.card.id, candidate.virtualCard] as const]
          : [],
      ),
    );
    const virtualContentById = new Map(
      available.flatMap((candidate) =>
        "virtualContent" in candidate && candidate.virtualContent
          ? [[candidate.card.id, candidate.virtualContent] as const]
          : [],
      ),
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
    const availableCardIds = available.map(({ card }) => card.id);
    const latestReviewRows =
      query.includeAll && !referenceBrowsing && availableCardIds.length > 0
        ? await db
            .selectDistinctOn([reviewEvents.cardId], {
              cardId: reviewEvents.cardId,
              rating: reviewEvents.rating,
              reviewedAt: reviewEvents.reviewedAt,
            })
            .from(reviewEvents)
            .where(
              and(
                eq(reviewEvents.userId, request.user.id),
                inArray(reviewEvents.cardId, availableCardIds),
              ),
            )
            .orderBy(
              reviewEvents.cardId,
              desc(reviewEvents.reviewedAt),
              desc(reviewEvents.createdAt),
            )
        : [];
    const latestResetRows =
      query.includeAll && !referenceBrowsing && availableCardIds.length > 0
        ? await db
            .selectDistinctOn([studyResetCards.cardId], {
              cardId: studyResetCards.cardId,
              resetAt: studyResets.resetAt,
            })
            .from(studyResetCards)
            .innerJoin(studyResets, eq(studyResets.id, studyResetCards.resetId))
            .where(
              and(
                eq(studyResets.userId, request.user.id),
                inArray(studyResetCards.cardId, availableCardIds),
              ),
            )
            .orderBy(studyResetCards.cardId, desc(studyResets.resetAt))
        : [];
    const latestResetByCard = new Map(
      latestResetRows.map((reset) => [reset.cardId, reset.resetAt]),
    );
    const lastRatingByCard = new Map(
      latestReviewRows.flatMap((event) => {
        const resetAt = latestResetByCard.get(event.cardId);
        return !resetAt || event.reviewedAt > resetAt
          ? [[event.cardId, event.rating] as const]
          : [];
      }),
    );
    const shuffleSeed = [
      request.user.id,
      request.user.sessionId,
      now.toISOString().slice(0, 10),
      query.deckId ?? "all-decks",
      query.xefjordSourceDeckId ?? "standard",
      query.xefjordTargetDeckId ?? "standard",
      query.xefjordMode ?? "standard",
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
            isDueQuestion: shouldQueueStudyQuestion({
              kind: card.kind,
              includeAll: query.includeAll,
              includeNew: query.includeNew,
              dueAt: progress?.due ?? null,
              now,
            }),
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
        virtualCard: virtualCardsById.get(card.id),
        virtualContent: virtualContentById.get(card.id),
        studyMode: referenceCardIds.has(card.id)
          ? ("REFERENCE" as const)
          : ("LEARNING" as const),
        progress: progressByCard.get(card.id),
      }))
      .map(({ card, virtualCard, virtualContent, progress, studyMode }) => {
        const state = progressToState(progress, now);
        return {
          card,
          virtualCard,
          virtualContent,
          studyMode,
          lastRating: lastRatingByCard.get(card.id) ?? null,
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
        virtualCard: z
          .object({
            kind: z.literal(xefjordVirtualStudyKind),
            questionDeckId: z.uuid(),
            answerDeckId: z.uuid(),
            matchKey: z.string().regex(/^[0-9a-f]{64}$/),
          })
          .optional(),
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
    if ((privateCard || subscribedCard) && input.virtualCard) {
      throw Object.assign(
        new Error("Physical cards cannot use virtual metadata"),
        {
          statusCode: 422,
        },
      );
    }
    const [registeredVirtualCard] =
      !privateCard && !subscribedCard && input.virtualCard
        ? await db
            .select({ id: virtualStudyTargets.id })
            .from(virtualStudyTargets)
            .where(
              and(
                eq(virtualStudyTargets.id, input.cardId),
                eq(virtualStudyTargets.userId, request.user.id),
                eq(virtualStudyTargets.kind, input.virtualCard.kind),
                eq(
                  virtualStudyTargets.questionDeckId,
                  input.virtualCard.questionDeckId,
                ),
                eq(
                  virtualStudyTargets.answerDeckId,
                  input.virtualCard.answerDeckId,
                ),
                eq(virtualStudyTargets.matchKey, input.virtualCard.matchKey),
              ),
            )
            .limit(1)
        : [];
    const resolvedVirtualCard =
      !privateCard &&
      !subscribedCard &&
      input.virtualCard &&
      !registeredVirtualCard
        ? await resolveXefjordCrossLanguageCard(
            request.user.id,
            input.virtualCard,
            input.cardId,
          )
        : null;
    if (
      !privateCard &&
      !subscribedCard &&
      !registeredVirtualCard &&
      !resolvedVirtualCard
    ) {
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
      if (resolvedVirtualCard && input.virtualCard) {
        await tx
          .insert(virtualStudyTargets)
          .values({
            id: input.cardId,
            userId: request.user.id,
            kind: input.virtualCard.kind,
            questionDeckId: input.virtualCard.questionDeckId,
            answerDeckId: input.virtualCard.answerDeckId,
            matchKey: input.virtualCard.matchKey,
          })
          .onConflictDoNothing();
      }
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
