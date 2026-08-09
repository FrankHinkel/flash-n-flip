import { createHash } from "node:crypto";

import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  aggregateDeckMetrics,
  aggregateProgressUnitMetrics,
  cardKindSchema,
  createId,
  deckStudyOrderSchema,
  deckDescendantIds,
  geographyMapIds,
  geographyRegions,
  resolveDeckLanguageDirection,
  restorableDeckIds,
  visibleDeckIds,
} from "@flashcards/domain";
import {
  numberLanguages,
  numberPracticeRanges,
  type NumberLocale,
  type NumberPracticeMaximum,
} from "@flashcards/domain/numbers";
import {
  cardContentSchema,
  contentLocaleSchema,
  localizedCardContentsSchema,
  isValidCardContentPair,
  validateCardContent,
} from "@flashcards/domain/content";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import {
  cardProgress,
  cards,
  decks,
  notes,
  publications,
  reviewEvents,
  syncMutations,
  virtualStudyTargets,
} from "../db/schema.js";
import {
  coreLanguageConceptCount,
  coreLanguageLocales,
  coreLanguageTemplateKey,
  createCoreLanguageDeckSeeds,
  stableTemplateUuid,
} from "../services/core-language-deck.js";
import { syncCoreLanguageDecksForOwner } from "../services/core-language-deck-sync.js";
import {
  conjugationCardCount,
  conjugationCollectionLocales,
  conjugationCollectionTemplateKey,
  conjugationDeckCount,
  conjugationLanguageCount,
  conjugationLanguageSummaries,
  conjugationVerbCount,
  createConjugationCollectionDeckSeeds,
} from "../services/conjugation-deck.js";
import { syncConjugationDecksForOwner } from "../services/conjugation-deck-sync.js";
import {
  createDeveloperReferenceDeckSeeds,
  developerReferenceCardCount,
  developerReferenceDefinition,
  developerReferenceDefinitions,
  developerReferenceIds,
  type DeveloperReferenceId,
} from "../services/developer-reference-decks.js";
import {
  createDeveloperReferenceLibraryDeckSeeds,
  developerReferenceLibraryCardCount,
  developerReferenceLibraryCategoryCount,
  developerReferenceLibraryDeckCount,
  developerReferenceLibraryEntryKey,
  developerReferenceLibraryTechnologyCount,
  developerReferenceLibraryTemplateKey,
  developerReferenceLibraryTemplateKeys,
} from "../services/developer-reference-library.js";
import { createEuropeDeckSeed } from "../services/europe-deck.js";
import {
  createGeographyDeckSeed,
  geographyTemplateKey,
  geographyTemplateInstallOrder,
  geographyTemplates,
  type GeographyTemplateId,
} from "../services/geography-decks.js";
import {
  numberCollectionTemplate,
  numberCollectionTemplateKey,
  syncNumberCollectionForOwner,
} from "../services/number-collection.js";
import {
  germanVerbCardCount,
  germanVerbCount,
  germanVerbTemplateKey,
} from "../services/german-verb-deck.js";
import {
  createIrregularVerbDeckSeeds,
  irregularVerbCardCount,
  irregularVerbCollectionTemplateKey,
  irregularVerbCount,
  irregularVerbDeckCount,
  irregularVerbLanguageCount,
  irregularVerbLanguageSummaries,
  irregularVerbLocales,
} from "../services/irregular-verb-deck.js";
import { syncIrregularVerbDecksForOwner } from "../services/irregular-verb-deck-sync.js";
import {
  createKatexReferenceDeckSeeds,
  katexReferenceCardCount,
  katexReferenceDeckCount,
  katexReferenceTemplateKey,
} from "../services/katex-reference-deck.js";

const templateIdSchema = z.enum(geographyMapIds);
const developerReferenceIdSchema = z.enum(developerReferenceIds);

const deckInputShape = {
  parentDeckId: z.uuid().nullable().default(null),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  language: contentLocaleSchema.default("en"),
  contentLocales: z.array(contentLocaleSchema).min(1).max(20).default(["en"]),
  defaultContentLocale: contentLocaleSchema.default("en"),
  sourceLocale: contentLocaleSchema.optional(),
  targetLocale: contentLocaleSchema.optional(),
  studyOrder: deckStudyOrderSchema.default("SCHEDULED"),
  protectionMode: z
    .enum(["STANDARD", "ACCOUNT_BOUND"])
    .default("ACCOUNT_BOUND"),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  visual: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("GLOBE"), value: z.literal("world") }),
      z.object({ kind: z.literal("MAP"), value: templateIdSchema }),
      z.object({
        kind: z.literal("FLAG"),
        value: z.string().regex(/^[A-Z]{2}$/),
      }),
      z.object({ kind: z.literal("IMAGE"), value: z.uuid() }),
    ])
    .nullable()
    .default(null),
};

const deckPatchShape = {
  parentDeckId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  language: contentLocaleSchema,
  contentLocales: z.array(contentLocaleSchema).min(1).max(20),
  defaultContentLocale: contentLocaleSchema,
  sourceLocale: contentLocaleSchema,
  targetLocale: contentLocaleSchema,
  studyOrder: deckStudyOrderSchema,
  protectionMode: z.enum(["STANDARD", "ACCOUNT_BOUND"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  visual: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("GLOBE"), value: z.literal("world") }),
      z.object({ kind: z.literal("MAP"), value: templateIdSchema }),
      z.object({
        kind: z.literal("FLAG"),
        value: z.string().regex(/^[A-Z]{2}$/),
      }),
      z.object({ kind: z.literal("IMAGE"), value: z.uuid() }),
    ])
    .nullable(),
};

const deckInputSchema = z
  .object(deckInputShape)
  .refine(
    (input) => input.contentLocales.includes(input.defaultContentLocale),
    {
      path: ["defaultContentLocale"],
      message: "Default content locale must be available in the deck",
    },
  )
  .transform((input) => ({
    ...input,
    ...resolveDeckLanguageDirection({
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      fallbackLocale: input.defaultContentLocale,
    }),
  }));

const deckUpdateSchema = z.object(deckPatchShape).partial().extend({
  version: z.number().int().positive(),
});

const cardInputSchema = z.object({
  front: cardContentSchema,
  back: cardContentSchema,
  questionLocale: contentLocaleSchema.nullable().optional(),
  answerLocale: contentLocaleSchema.nullable().optional(),
  kind: cardKindSchema.default("QUESTION"),
  linkedToPrevious: z.boolean().default(false),
  translations: localizedCardContentsSchema.default({}),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

const cardUpdateSchema = z.object({
  front: cardContentSchema,
  back: cardContentSchema,
  questionLocale: contentLocaleSchema.nullable().optional(),
  answerLocale: contentLocaleSchema.nullable().optional(),
  kind: cardKindSchema,
  linkedToPrevious: z.boolean().default(false),
  translations: localizedCardContentsSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  version: z.number().int().positive(),
});

const cardOrderSchema = z.object({
  cardIds: z.array(z.uuid()).min(1).max(20_000),
  version: z.number().int().positive(),
  cardPage: z.number().int().min(1).optional(),
  cardPageSize: z.number().int().min(1).max(1_000).optional(),
});

const deckEditorCommitSchema = z
  .object({
    mutationId: z.uuid(),
    version: z.number().int().positive(),
    deck: z.object(deckPatchShape).partial(),
    createdCards: z
      .array(cardInputSchema.extend({ id: z.uuid(), noteId: z.uuid() }))
      .max(1_000),
    updatedCards: z.array(cardUpdateSchema.extend({ id: z.uuid() })).max(1_000),
    deletedCards: z
      .array(z.object({ id: z.uuid(), version: z.number().int().positive() }))
      .max(1_000),
    cardOrder: z.object({
      cardIds: z.array(z.uuid()).max(20_000),
      cardPage: z.number().int().min(1),
      cardPageSize: z.number().int().min(1).max(1_000),
      cardSearch: z.string().trim().max(200).optional(),
    }),
  })
  .superRefine((input, context) => {
    const operationIds = [
      ...input.createdCards.map(({ id }) => id),
      ...input.updatedCards.map(({ id }) => id),
      ...input.deletedCards.map(({ id }) => id),
    ];
    if (new Set(operationIds).size !== operationIds.length) {
      context.addIssue({
        code: "custom",
        path: ["createdCards"],
        message: "A card can have only one editor operation",
      });
    }
    if (
      new Set(input.cardOrder.cardIds).size !== input.cardOrder.cardIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["cardOrder", "cardIds"],
        message: "Card order contains duplicates",
      });
    }
  });

const deckCardPageQuerySchema = z.object({
  cardPage: z.coerce.number().int().min(1).optional(),
  cardPageSize: z.coerce.number().int().min(1).max(1_000).default(1_000),
  cardSearch: z.string().trim().max(200).optional(),
});

const literalCardSearchPattern = (value: string): string =>
  `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

const cardSearchCondition = (search: string | undefined) => {
  if (!search) return undefined;
  const pattern = literalCardSearchPattern(search);
  return or(
    sql<boolean>`${cards.front}::text ILIKE ${pattern} ESCAPE '\\'`,
    sql<boolean>`${cards.back}::text ILIKE ${pattern} ESCAPE '\\'`,
    sql<boolean>`${cards.translations}::text ILIKE ${pattern} ESCAPE '\\'`,
  );
};

const loadDeckCardPage = async (
  deckId: string,
  requestedPage: number,
  pageSize: number,
  search?: string,
) => {
  const searchCondition = cardSearchCondition(search);
  const where = searchCondition
    ? and(eq(cards.deckId, deckId), searchCondition)
    : eq(cards.deckId, deckId);
  const [total] = await db.select({ value: count() }).from(cards).where(where);
  const totalCards = Number(total?.value ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCards / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageCards = await db
    .select()
    .from(cards)
    .where(where)
    .orderBy(cards.position, cards.createdAt)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    cards: pageCards,
    cardPage: { page, pageSize, totalCards, totalPages },
  };
};

const requireOwnedDeck = async (deckId: string, userId: string) => {
  const [deck] = await db
    .select()
    .from(decks)
    .where(
      and(
        eq(decks.id, deckId),
        eq(decks.ownerId, userId),
        isNull(decks.archivedAt),
      ),
    )
    .limit(1);
  if (!deck) {
    throw Object.assign(new Error("Deck not found"), { statusCode: 404 });
  }
  return deck;
};

const requireValidParent = async (
  parentDeckId: string | null,
  userId: string,
  deckId?: string,
) => {
  if (!parentDeckId) return;
  const visited = new Set<string>();
  let currentId: string | null = parentDeckId;
  while (currentId) {
    if (currentId === deckId || visited.has(currentId)) {
      throw Object.assign(new Error("Deck hierarchy cannot contain a cycle"), {
        statusCode: 400,
      });
    }
    visited.add(currentId);
    const [parent]: Array<{ id: string; parentDeckId: string | null }> =
      await db
        .select({ id: decks.id, parentDeckId: decks.parentDeckId })
        .from(decks)
        .where(
          and(
            eq(decks.id, currentId),
            eq(decks.ownerId, userId),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
    if (!parent) {
      throw Object.assign(new Error("Parent deck not found"), {
        statusCode: 404,
      });
    }
    currentId = parent.parentDeckId;
  }
};

const requireAvailableTranslationLocales = (
  translations: Record<string, unknown>,
  availableLocales: readonly string[],
) => {
  const unavailable = Object.keys(translations).filter(
    (locale) => !availableLocales.includes(locale),
  );
  if (unavailable.length > 0) {
    throw Object.assign(
      new Error(`Unavailable card locale: ${unavailable.join(", ")}`),
      { statusCode: 400 },
    );
  }
};

const ownedDeckHierarchy = (userId: string) =>
  db
    .select({
      id: decks.id,
      parentDeckId: decks.parentDeckId,
      archivedAt: decks.archivedAt,
    })
    .from(decks)
    .where(eq(decks.ownerId, userId));

const requireOwnedArchivedDeck = async (deckId: string, userId: string) => {
  const hierarchy = await ownedDeckHierarchy(userId);
  const deck = hierarchy.find((candidate) => candidate.id === deckId);
  if (!deck?.archivedAt) {
    throw Object.assign(new Error("Trashed deck not found"), {
      statusCode: 404,
    });
  }
  return { deck, hierarchy };
};

export const registerDeckRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/decks", { preHandler: authenticate }, async (request) => {
    const { includeHidden, includeArchived } = z
      .object({
        includeHidden: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
        includeArchived: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
      })
      .parse(request.query);
    const rows = await db
      .select({
        id: decks.id,
        parentDeckId: decks.parentDeckId,
        title: decks.title,
        description: decks.description,
        language: decks.language,
        contentLocales: decks.contentLocales,
        defaultContentLocale: decks.defaultContentLocale,
        sourceLocale: decks.sourceLocale,
        targetLocale: decks.targetLocale,
        studyOrder: decks.studyOrder,
        protectionMode: decks.protectionMode,
        tags: decks.tags,
        favorite: decks.favorite,
        hiddenAt: decks.hiddenAt,
        archivedAt: decks.archivedAt,
        visual: decks.visual,
        sourceTemplateKey: decks.sourceTemplateKey,
        version: decks.version,
        updatedAt: decks.updatedAt,
        cardCount: count(cards.id),
        reviewedCardCount: sql<number>`
          count(${cards.id})
          filter (
            where ${cards.kind} = 'QUESTION'
              and ${cardProgress.reps} > 0
          )
        `.mapWith(Number),
        cardDirections: sql<
          Record<string, { cardCount: number; reviewedCardCount: number }>
        >`
          coalesce(
            (
              select jsonb_object_agg(
                direction_counts.direction_key,
                jsonb_build_object(
                  'cardCount', direction_counts.card_count,
                  'reviewedCardCount', direction_counts.reviewed_card_count
                )
              )
              from (
                select
                  direction_card.question_locale || '→' || direction_card.answer_locale
                    as direction_key,
                  count(*)::integer as card_count,
                  count(*) filter (
                    where direction_progress.reps > 0
                  )::integer as reviewed_card_count
                from cards as direction_card
                left join card_progress as direction_progress
                  on direction_progress.card_id = direction_card.id
                  and direction_progress.user_id = ${request.user.id}
                where direction_card.deck_id = ${decks.id}
                  and direction_card.kind = 'QUESTION'
                  and direction_card.question_locale is not null
                  and direction_card.answer_locale is not null
                  and direction_card.question_locale <> direction_card.answer_locale
                group by
                  direction_card.question_locale,
                  direction_card.answer_locale
              ) as direction_counts
            ),
            '{}'::jsonb
          )
        `,
        storageBytes: sql<number>`
          (
            pg_column_size(${decks.id})
            + pg_column_size(${decks.title})
            + pg_column_size(${decks.description})
            + pg_column_size(${decks.contentLocales})
            + pg_column_size(${decks.sourceLocale})
            + pg_column_size(${decks.targetLocale})
            + pg_column_size(${decks.tags})
            + coalesce(pg_column_size(${decks.visual}), 0)
            + coalesce(
                sum(
                  case
                    when ${cards.id} is null then 0
                    else
                      pg_column_size(${cards.id})
                      + pg_column_size(${cards.front})
                      + pg_column_size(${cards.back})
                      + pg_column_size(${cards.translations})
                      + coalesce(pg_column_size(${notes.fields}), 0)
                      + coalesce(pg_column_size(${notes.tags}), 0)
                  end
                ),
                0
              )
            + coalesce(
                (
                  select sum(deck_media.byte_size)
                  from media as deck_media
                  join (
                    select distinct
                      (media_ref.value #>> '{}')::uuid as id
                    from cards as media_card
                    cross join lateral (
                      select jsonb_path_query(
                        jsonb_build_array(
                          media_card.front,
                          media_card.back,
                          media_card.translations
                        ),
                        '$.**.mediaId'
                      ) as value
                      union all
                      select jsonb_path_query(
                        jsonb_build_array(
                          media_card.front,
                          media_card.back,
                          media_card.translations
                        ),
                        '$.**.posterMediaId'
                      ) as value
                      union all
                      select jsonb_path_query(
                        jsonb_build_array(
                          media_card.front,
                          media_card.back,
                          media_card.translations
                        ),
                        '$.**.baseMediaId'
                      ) as value
                      union all
                      select jsonb_path_query(
                        jsonb_build_array(
                          media_card.front,
                          media_card.back,
                          media_card.translations
                        ),
                        '$.**.overlayMediaId'
                      ) as value
                    ) as media_ref
                    where media_card.deck_id = ${decks.id}
                  ) as deck_media_refs on deck_media_refs.id = deck_media.id
                  where deck_media.owner_id = ${request.user.id}
                    and deck_media.deleted_at is null
                ),
                0
              )
          )
        `.mapWith(Number),
      })
      .from(decks)
      .leftJoin(cards, eq(cards.deckId, decks.id))
      .leftJoin(notes, eq(notes.id, cards.noteId))
      .leftJoin(
        cardProgress,
        and(
          eq(cardProgress.cardId, cards.id),
          eq(cardProgress.userId, request.user.id),
        ),
      )
      .where(
        includeArchived
          ? eq(decks.ownerId, request.user.id)
          : and(eq(decks.ownerId, request.user.id), isNull(decks.archivedAt)),
      )
      .groupBy(decks.id)
      .orderBy(decks.updatedAt);
    const activeRows = rows.filter((deck) => !deck.archivedAt);
    const activeIds = includeHidden
      ? new Set(activeRows.map((deck) => deck.id))
      : visibleDeckIds(activeRows);
    const archivedIds = new Set(
      rows.filter((deck) => deck.archivedAt).map((deck) => deck.id),
    );
    const activeMetrics = aggregateDeckMetrics(rows, activeIds);
    const archivedMetrics = aggregateDeckMetrics(rows, archivedIds);
    const activeProgressUnits = aggregateProgressUnitMetrics(rows, activeIds);
    const archivedProgressUnits = aggregateProgressUnitMetrics(
      rows,
      archivedIds,
    );
    return rows
      .filter(
        (deck) =>
          (deck.archivedAt && includeArchived) ||
          (!deck.archivedAt && activeIds.has(deck.id)),
      )
      .map((deck) => {
        const progressUnits = deck.archivedAt
          ? archivedProgressUnits.get(deck.id)
          : activeProgressUnits.get(deck.id);
        return {
          ...deck,
          ...(deck.archivedAt
            ? archivedMetrics.get(deck.id)!
            : activeMetrics.get(deck.id)!),
          ...(progressUnits
            ? { progressUnits: { kind: "CATEGORY" as const, ...progressUnits } }
            : {}),
        };
      });
  });

  app.post("/decks", { preHandler: authenticate }, async (request, reply) => {
    const input = deckInputSchema.parse(request.body);
    await requireValidParent(input.parentDeckId, request.user.id);
    const id = createId();
    const [deck] = await db
      .insert(decks)
      .values({ id, ownerId: request.user.id, ...input })
      .returning();
    return reply.code(201).send(deck);
  });

  app.get(
    "/decks/templates/numbers",
    { preHandler: authenticate },
    async (request) => {
      const [installed] = await db
        .select({ id: decks.id, hiddenAt: decks.hiddenAt })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            eq(decks.sourceTemplateKey, numberCollectionTemplateKey),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
      return {
        ...numberCollectionTemplate,
        installedDeckId: installed && !installed.hiddenAt ? installed.id : null,
      };
    },
  );

  app.post(
    "/decks/templates/numbers/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const input = z
        .object({
          sourceLocale: z.string(),
          targetLocale: z.string(),
          maximum: z.number().int(),
          uiLocale: z.enum(["en", "de"]).default("en"),
        })
        .superRefine((value, context) => {
          const locales = new Set(numberLanguages.map(({ locale }) => locale));
          if (!locales.has(value.sourceLocale as NumberLocale)) {
            context.addIssue({
              code: "custom",
              path: ["sourceLocale"],
              message: "Unsupported source locale",
            });
          }
          if (!locales.has(value.targetLocale as NumberLocale)) {
            context.addIssue({
              code: "custom",
              path: ["targetLocale"],
              message: "Unsupported target locale",
            });
          }
          if (value.sourceLocale === value.targetLocale) {
            context.addIssue({
              code: "custom",
              path: ["targetLocale"],
              message: "Source and target locale must differ",
            });
          }
          if (
            !numberPracticeRanges.includes(
              value.maximum as NumberPracticeMaximum,
            )
          ) {
            context.addIssue({
              code: "custom",
              path: ["maximum"],
              message: "Unsupported number range",
            });
          }
        })
        .parse(request.body);
      const result = await syncNumberCollectionForOwner(db, request.user.id, {
        sourceLocale: input.sourceLocale as NumberLocale,
        targetLocale: input.targetLocale as NumberLocale,
        maximum: input.maximum as NumberPracticeMaximum,
        uiLocale: input.uiLocale,
      });
      return reply.code(result.createdDeckCount === 0 ? 200 : 201).send({
        installedDeckIds: [...result.idsByKey.values()],
        selectedDeckId: result.rootDeckId,
        pairDeckId: result.pairDeckId,
      });
    },
  );

  app.get(
    "/decks/templates/core-languages",
    { preHandler: authenticate },
    async (request) => {
      const [installed] = await db
        .select({ id: decks.id, hiddenAt: decks.hiddenAt })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            eq(decks.sourceTemplateKey, coreLanguageTemplateKey),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
      return {
        title: "Core Languages: Core 100",
        description:
          "100 shared words and short phrases in English, German, French, and Spanish.",
        conceptCount: coreLanguageConceptCount,
        cardCount: coreLanguageConceptCount,
        locales: coreLanguageLocales,
        installedDeckId: installed && !installed.hiddenAt ? installed.id : null,
      };
    },
  );

  app.post(
    "/decks/templates/core-languages/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const result = await syncCoreLanguageDecksForOwner(db, request.user.id);

      return reply.code(result.createdDeckCount === 0 ? 200 : 201).send({
        installedDeckIds: createCoreLanguageDeckSeeds().map((seed) =>
          result.idsByKey.get(seed.key)!,
        ),
        selectedDeckId: result.idsByKey.get(coreLanguageTemplateKey)!,
      });
    },
  );

  app.get(
    "/decks/templates/conjugations",
    { preHandler: authenticate },
    async (request) => {
      const [installed] = await db
        .select({ id: decks.id, hiddenAt: decks.hiddenAt })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            eq(decks.sourceTemplateKey, conjugationCollectionTemplateKey),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
      return {
        title: "Konjugation",
        description:
          "Deutsch, Spanisch, Englisch und Französisch: wichtige Verben in sechs Zeitformen mit Erklärungen, Zeitstrahlen und interaktiven Tabellen.",
        languageCount: conjugationLanguageCount,
        verbCount: conjugationVerbCount,
        cardCount: conjugationCardCount,
        deckCount: conjugationDeckCount,
        locales: conjugationCollectionLocales,
        languages: conjugationLanguageSummaries,
        installedDeckId: installed && !installed.hiddenAt ? installed.id : null,
      };
    },
  );

  app.post(
    "/decks/templates/conjugations/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const result = await syncConjugationDecksForOwner(db, request.user.id);
      const seeds = createConjugationCollectionDeckSeeds();
      return reply.code(result.createdDeckCount === 0 ? 200 : 201).send({
        installedDeckIds: seeds.map((seed) => result.idsByKey.get(seed.key)!),
        selectedDeckId: result.idsByKey.get(conjugationCollectionTemplateKey)!,
      });
    },
  );

  app.get(
    "/decks/templates/irregular-verbs",
    { preHandler: authenticate },
    async (request) => {
      const [installed] = await db
        .select({ id: decks.id, hiddenAt: decks.hiddenAt })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            eq(decks.sourceTemplateKey, irregularVerbCollectionTemplateKey),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
      return {
        title: "Irregular Verbs",
        description:
          "Je 60 wichtige unregelmäßige Verben in Deutsch, Englisch, Spanisch und Französisch als interaktive Stammformtabellen.",
        languageCount: irregularVerbLanguageCount,
        verbCount: irregularVerbCount,
        cardCount: irregularVerbCardCount,
        deckCount: irregularVerbDeckCount,
        locales: irregularVerbLocales,
        languages: irregularVerbLanguageSummaries,
        installedDeckId: installed && !installed.hiddenAt ? installed.id : null,
      };
    },
  );

  app.post(
    "/decks/templates/irregular-verbs/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const result = await syncIrregularVerbDecksForOwner(db, request.user.id);
      const seeds = createIrregularVerbDeckSeeds();
      return reply.code(result.createdDeckCount === 0 ? 200 : 201).send({
        installedDeckIds: seeds.map((seed) => result.idsByKey.get(seed.key)!),
        selectedDeckId: result.idsByKey.get(
          irregularVerbCollectionTemplateKey,
        )!,
      });
    },
  );

  app.get(
    "/decks/templates/german-irregular-verbs",
    { preHandler: authenticate },
    async (request) => {
      const [installed] = await db
        .select({ id: decks.id, hiddenAt: decks.hiddenAt })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            eq(decks.sourceTemplateKey, germanVerbTemplateKey),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
      return {
        title: "Konjugation DE",
        description: `${germanVerbCount} wichtige Verben in allen sechs deutschen Zeitformen mit Erklärungen und interaktiven Auswahllücken.`,
        verbCount: germanVerbCount,
        cardCount: germanVerbCardCount,
        installedDeckId: installed && !installed.hiddenAt ? installed.id : null,
      };
    },
  );

  app.post(
    "/decks/templates/german-irregular-verbs/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const result = await syncConjugationDecksForOwner(db, request.user.id);
      const germanSeeds = createConjugationCollectionDeckSeeds().filter(
        (seed) =>
          seed.locale === "de" && seed.key !== conjugationCollectionTemplateKey,
      );
      return reply.code(result.createdDeckCount === 0 ? 200 : 201).send({
        installedDeckIds: germanSeeds.map((seed) =>
          result.idsByKey.get(seed.key)!,
        ),
        selectedDeckId: result.idsByKey.get(germanVerbTemplateKey)!,
      });
    },
  );

  app.get(
    "/decks/templates/developer-reference-library",
    { preHandler: authenticate },
    async (request) => {
      const installed = await db
        .select({
          id: decks.id,
          hiddenAt: decks.hiddenAt,
          sourceTemplateKey: decks.sourceTemplateKey,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(
              decks.sourceTemplateKey,
              developerReferenceLibraryTemplateKeys,
            ),
            isNull(decks.archivedAt),
          ),
        );
      const libraryRoot = installed.find(
        (item) =>
          item.sourceTemplateKey === developerReferenceLibraryTemplateKey,
      );
      return {
        title: "Developer Reference Library",
        description:
          "One structured English-language library for essential development tools, platforms, query languages, automation, and diagnostics.",
        categoryCount: developerReferenceLibraryCategoryCount,
        technologyCount: developerReferenceLibraryTechnologyCount,
        deckCount: developerReferenceLibraryDeckCount,
        cardCount: developerReferenceLibraryCardCount,
        installedDeckId:
          libraryRoot && !libraryRoot.hiddenAt ? libraryRoot.id : null,
        migrationAvailable:
          !libraryRoot && installed.some((item) => !item.hiddenAt),
      };
    },
  );

  app.post(
    "/decks/templates/developer-reference-library/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const seeds = createDeveloperReferenceLibraryDeckSeeds();
      const existing = await db
        .select({
          id: decks.id,
          sourceTemplateKey: decks.sourceTemplateKey,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(
              decks.sourceTemplateKey,
              developerReferenceLibraryTemplateKeys,
            ),
          ),
        );
      const idsByKey = new Map(
        existing.map((item) => [item.sourceTemplateKey!, item.id]),
      );

      await db.transaction(async (tx) => {
        for (const seed of seeds) {
          const parentDeckId = seed.parentKey
            ? (idsByKey.get(seed.parentKey) ?? null)
            : null;
          let deckId = idsByKey.get(seed.key);
          if (!deckId) {
            deckId = createId();
            await tx.insert(decks).values({
              id: deckId,
              ownerId: request.user.id,
              parentDeckId,
              title: seed.title,
              description: seed.description,
              language: "en",
              contentLocales: ["en"],
              defaultContentLocale: "en",
              sourceLocale: "en",
              targetLocale: "en",
              studyOrder: "SEQUENTIAL",
              protectionMode: "ACCOUNT_BOUND",
              tags: seed.tags,
              sourceTemplateKey: seed.key,
            });
            idsByKey.set(seed.key, deckId);
          } else {
            await tx
              .update(decks)
              .set({
                parentDeckId,
                title: seed.title,
                description: seed.description,
                language: "en",
                contentLocales: ["en"],
                defaultContentLocale: "en",
                sourceLocale: "en",
                targetLocale: "en",
                studyOrder: "SEQUENTIAL",
                tags: seed.tags,
                archivedAt: null,
                hiddenAt: null,
                updatedAt: new Date(),
              })
              .where(eq(decks.id, deckId));
          }

          for (const [index, item] of seed.cards.entries()) {
            const namespace =
              seed.cardNamespace === "katex"
                ? "katex-reference"
                : `${seed.cardNamespace}-reference`;
            const noteId = stableTemplateUuid(
              deckId,
              `${namespace}-note:${item.key}`,
            );
            const cardId = stableTemplateUuid(
              deckId,
              `${namespace}-card:${item.key}`,
            );
            const fields = {
              front: item.front,
              back: item.back,
              translations: {},
            };
            const tag = `fnf-template-card:${seed.key}:${item.key}`;
            await tx
              .insert(notes)
              .values({
                id: noteId,
                deckId,
                fields,
                tags: [tag],
              })
              .onConflictDoUpdate({
                target: notes.id,
                set: {
                  deckId,
                  fields,
                  tags: [tag],
                  version: sql`${notes.version} + 1`,
                  updatedAt: new Date(),
                },
              });
            await tx
              .insert(cards)
              .values({
                id: cardId,
                deckId,
                noteId,
                front: item.front,
                back: item.back,
                kind: "QUESTION",
                position: index + 1,
              })
              .onConflictDoUpdate({
                target: cards.id,
                set: {
                  deckId,
                  noteId,
                  front: item.front,
                  back: item.back,
                  translations: {},
                  kind: "QUESTION",
                  position: index + 1,
                  version: sql`${cards.version} + 1`,
                  updatedAt: new Date(),
                },
              });
          }
        }
      });

      return reply.code(existing.length ? 200 : 201).send({
        installedDeckIds: seeds.map((seed) => idsByKey.get(seed.key)!),
        selectedDeckId: idsByKey.get(developerReferenceLibraryEntryKey)!,
      });
    },
  );

  app.get(
    "/decks/templates/katex-reference",
    { preHandler: authenticate },
    async (request) => {
      const [installed] = await db
        .select({ id: decks.id, hiddenAt: decks.hiddenAt })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            eq(decks.sourceTemplateKey, katexReferenceTemplateKey),
            isNull(decks.archivedAt),
          ),
        )
        .limit(1);
      return {
        title: "KaTeX Developer Reference",
        description:
          "Rendered formulas, copyable syntax, explanations, and Flash-n-Flip integration examples.",
        deckCount: katexReferenceDeckCount,
        cardCount: katexReferenceCardCount,
        installedDeckId: installed && !installed.hiddenAt ? installed.id : null,
      };
    },
  );

  app.post(
    "/decks/templates/katex-reference/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const seeds = createKatexReferenceDeckSeeds();
      const keys = seeds.map((seed) => seed.key);
      const existing = await db
        .select({
          id: decks.id,
          sourceTemplateKey: decks.sourceTemplateKey,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(decks.sourceTemplateKey, keys),
          ),
        );
      const idsByKey = new Map(
        existing.map((item) => [item.sourceTemplateKey!, item.id]),
      );

      await db.transaction(async (tx) => {
        for (const seed of seeds) {
          const parentDeckId = seed.parentKey
            ? (idsByKey.get(seed.parentKey) ?? null)
            : null;
          let deckId = idsByKey.get(seed.key);
          if (!deckId) {
            deckId = createId();
            await tx.insert(decks).values({
              id: deckId,
              ownerId: request.user.id,
              parentDeckId,
              title: seed.title,
              description: seed.description,
              language: "en",
              contentLocales: ["en"],
              defaultContentLocale: "en",
              sourceLocale: "en",
              targetLocale: "en",
              studyOrder: "SEQUENTIAL",
              protectionMode: "ACCOUNT_BOUND",
              tags: ["KaTeX", "Mathematics", "Developer reference"],
              sourceTemplateKey: seed.key,
            });
            idsByKey.set(seed.key, deckId);
          } else {
            await tx
              .update(decks)
              .set({
                ...(seed.parentKey ? { parentDeckId } : {}),
                title: seed.title,
                description: seed.description,
                language: "en",
                contentLocales: ["en"],
                defaultContentLocale: "en",
                sourceLocale: "en",
                targetLocale: "en",
                studyOrder: "SEQUENTIAL",
                tags: ["KaTeX", "Mathematics", "Developer reference"],
                archivedAt: null,
                hiddenAt: null,
                updatedAt: new Date(),
              })
              .where(eq(decks.id, deckId));
          }

          for (const [index, item] of seed.cards.entries()) {
            const noteId = stableTemplateUuid(
              deckId,
              `katex-reference-note:${item.key}`,
            );
            const cardId = stableTemplateUuid(
              deckId,
              `katex-reference-card:${item.key}`,
            );
            const fields = {
              front: item.front,
              back: item.back,
              translations: {},
            };
            const tag = `fnf-template-card:${seed.key}:${item.key}`;
            await tx
              .insert(notes)
              .values({
                id: noteId,
                deckId,
                fields,
                tags: [tag],
              })
              .onConflictDoUpdate({
                target: notes.id,
                set: {
                  deckId,
                  fields,
                  tags: [tag],
                  version: sql`${notes.version} + 1`,
                  updatedAt: new Date(),
                },
              });
            await tx
              .insert(cards)
              .values({
                id: cardId,
                deckId,
                noteId,
                front: item.front,
                back: item.back,
                kind: "QUESTION",
                position: index + 1,
              })
              .onConflictDoUpdate({
                target: cards.id,
                set: {
                  deckId,
                  noteId,
                  front: item.front,
                  back: item.back,
                  translations: {},
                  kind: "QUESTION",
                  position: index + 1,
                  version: sql`${cards.version} + 1`,
                  updatedAt: new Date(),
                },
              });
          }
        }
      });

      return reply.code(existing.length ? 200 : 201).send({
        installedDeckIds: seeds.map((seed) => idsByKey.get(seed.key)!),
        selectedDeckId: idsByKey.get(katexReferenceTemplateKey)!,
      });
    },
  );

  app.get(
    "/decks/templates/developer-references",
    { preHandler: authenticate },
    async (request) => {
      const templateKeys = developerReferenceDefinitions.flatMap(
        (definition) => [
          definition.templateKey,
          `${definition.templateKey}:introduction`,
        ],
      );
      const installed = await db
        .select({
          id: decks.id,
          hiddenAt: decks.hiddenAt,
          sourceTemplateKey: decks.sourceTemplateKey,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(decks.sourceTemplateKey, templateKeys),
            isNull(decks.archivedAt),
          ),
        );
      const installedByKey = new Map(
        installed.map((item) => [item.sourceTemplateKey, item]),
      );

      return developerReferenceDefinitions.map((definition) => {
        const current = installedByKey.get(definition.templateKey);
        const introduction = installedByKey.get(
          `${definition.templateKey}:introduction`,
        );
        return {
          id: definition.id,
          title: definition.title,
          description: definition.description,
          deckCount: definition.decks.length,
          cardCount: developerReferenceCardCount(definition.id),
          installedDeckId: current && !current.hiddenAt ? current.id : null,
          entryDeckId:
            current &&
            !current.hiddenAt &&
            introduction &&
            !introduction.hiddenAt
              ? introduction.id
              : null,
        };
      });
    },
  );

  app.post(
    "/decks/templates/developer-references/:templateId/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const templateId = developerReferenceIdSchema.parse(
        (request.params as { templateId: string }).templateId,
      ) as DeveloperReferenceId;
      const definition = developerReferenceDefinition(templateId);
      const seeds = createDeveloperReferenceDeckSeeds(templateId);
      const keys = seeds.map((seed) => seed.key);
      const existing = await db
        .select({
          id: decks.id,
          sourceTemplateKey: decks.sourceTemplateKey,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(decks.sourceTemplateKey, keys),
          ),
        );
      const idsByKey = new Map(
        existing.map((item) => [item.sourceTemplateKey!, item.id]),
      );

      await db.transaction(async (tx) => {
        for (const seed of seeds) {
          const parentDeckId = seed.parentKey
            ? (idsByKey.get(seed.parentKey) ?? null)
            : null;
          let deckId = idsByKey.get(seed.key);
          if (!deckId) {
            deckId = createId();
            await tx.insert(decks).values({
              id: deckId,
              ownerId: request.user.id,
              parentDeckId,
              title: seed.title,
              description: seed.description,
              language: "en",
              contentLocales: ["en"],
              defaultContentLocale: "en",
              sourceLocale: "en",
              targetLocale: "en",
              studyOrder: "SEQUENTIAL",
              protectionMode: "ACCOUNT_BOUND",
              tags: definition.tags,
              sourceTemplateKey: seed.key,
            });
            idsByKey.set(seed.key, deckId);
          } else {
            await tx
              .update(decks)
              .set({
                ...(seed.parentKey ? { parentDeckId } : {}),
                title: seed.title,
                description: seed.description,
                language: "en",
                contentLocales: ["en"],
                defaultContentLocale: "en",
                sourceLocale: "en",
                targetLocale: "en",
                studyOrder: "SEQUENTIAL",
                tags: definition.tags,
                archivedAt: null,
                hiddenAt: null,
                updatedAt: new Date(),
              })
              .where(eq(decks.id, deckId));
          }

          for (const [index, item] of seed.cards.entries()) {
            const noteId = stableTemplateUuid(
              deckId,
              `${templateId}-reference-note:${item.key}`,
            );
            const cardId = stableTemplateUuid(
              deckId,
              `${templateId}-reference-card:${item.key}`,
            );
            const fields = {
              front: item.front,
              back: item.back,
              translations: {},
            };
            const tag = `fnf-template-card:${seed.key}:${item.key}`;
            await tx
              .insert(notes)
              .values({
                id: noteId,
                deckId,
                fields,
                tags: [tag],
              })
              .onConflictDoUpdate({
                target: notes.id,
                set: {
                  deckId,
                  fields,
                  tags: [tag],
                  version: sql`${notes.version} + 1`,
                  updatedAt: new Date(),
                },
              });
            await tx
              .insert(cards)
              .values({
                id: cardId,
                deckId,
                noteId,
                front: item.front,
                back: item.back,
                kind: "QUESTION",
                position: index + 1,
              })
              .onConflictDoUpdate({
                target: cards.id,
                set: {
                  deckId,
                  noteId,
                  front: item.front,
                  back: item.back,
                  translations: {},
                  kind: "QUESTION",
                  position: index + 1,
                  version: sql`${cards.version} + 1`,
                  updatedAt: new Date(),
                },
              });
          }
        }
      });

      return reply.code(existing.length ? 200 : 201).send({
        installedDeckIds: seeds.map((seed) => idsByKey.get(seed.key)!),
        selectedDeckId: idsByKey.get(`${definition.templateKey}:introduction`)!,
      });
    },
  );

  app.get(
    "/decks/templates/geography",
    { preHandler: authenticate },
    async (request) => {
      const templateKeys = geographyTemplates.map((template) =>
        geographyTemplateKey(template.id),
      );
      const installed = await db
        .select({
          id: decks.id,
          parentDeckId: decks.parentDeckId,
          hiddenAt: decks.hiddenAt,
          sourceTemplateKey: decks.sourceTemplateKey,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            isNull(decks.archivedAt),
            inArray(decks.sourceTemplateKey, templateKeys),
          ),
        );
      const visibleInstalledIds = visibleDeckIds(installed);
      const installedByKey = new Map(
        installed
          .filter((deck) => visibleInstalledIds.has(deck.id))
          .map((deck) => [deck.sourceTemplateKey, deck.id]),
      );
      return geographyTemplates.map((template) => ({
        id: template.id,
        parentId: template.parentId,
        titles: template.titles,
        descriptions: template.descriptions,
        visual:
          template.id === "world"
            ? { kind: "GLOBE" as const, value: "world" as const }
            : "countryCode" in template
              ? { kind: "FLAG" as const, value: template.countryCode }
              : { kind: "MAP" as const, value: template.mapId },
        regionCount: geographyRegions[template.mapId].length,
        installedDeckId:
          installedByKey.get(geographyTemplateKey(template.id)) ?? null,
      }));
    },
  );

  app.post(
    "/decks/templates/geography/:templateId/install",
    { preHandler: authenticate },
    async (request, reply) => {
      const { templateId } = z
        .object({ templateId: templateIdSchema })
        .parse(request.params);
      const { includeChildren } = z
        .object({ includeChildren: z.boolean().default(false) })
        .parse(request.body ?? {});
      const requested: GeographyTemplateId[] = geographyTemplateInstallOrder(
        templateId,
        includeChildren,
      );
      const requestedKeys = requested.map(geographyTemplateKey);
      const existing = await db
        .select({
          id: decks.id,
          sourceTemplateKey: decks.sourceTemplateKey,
          archivedAt: decks.archivedAt,
          hiddenAt: decks.hiddenAt,
        })
        .from(decks)
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(decks.sourceTemplateKey, requestedKeys),
          ),
        );
      const idsByTemplate = new Map<GeographyTemplateId, string>();
      const archivedTemplateIds = new Set<GeographyTemplateId>();
      const hiddenTemplateIds = new Set<GeographyTemplateId>();
      for (const deck of existing) {
        const template = geographyTemplates.find(
          (item) => geographyTemplateKey(item.id) === deck.sourceTemplateKey,
        );
        if (template) {
          idsByTemplate.set(template.id, deck.id);
          if (deck.archivedAt) archivedTemplateIds.add(template.id);
          if (deck.hiddenAt) hiddenTemplateIds.add(template.id);
        }
      }
      const installedDeckIds: string[] = [];
      await db.transaction(async (tx) => {
        for (const currentTemplateId of requested) {
          const existingId = idsByTemplate.get(currentTemplateId);
          if (existingId) {
            if (
              archivedTemplateIds.has(currentTemplateId) ||
              hiddenTemplateIds.has(currentTemplateId)
            ) {
              const template = geographyTemplates.find(
                (item) => item.id === currentTemplateId,
              )!;
              await tx
                .update(decks)
                .set({
                  archivedAt: null,
                  hiddenAt: null,
                  parentDeckId:
                    template.parentId === null
                      ? null
                      : (idsByTemplate.get(template.parentId) ?? null),
                  updatedAt: new Date(),
                })
                .where(eq(decks.id, existingId));
            }
            installedDeckIds.push(existingId);
            continue;
          }
          const seed = createGeographyDeckSeed(currentTemplateId);
          const deckId = createId();
          const parentDeckId =
            seed.parentTemplateId === null
              ? null
              : (idsByTemplate.get(seed.parentTemplateId) ?? null);
          await tx.insert(decks).values({
            id: deckId,
            ownerId: request.user.id,
            parentDeckId,
            title: seed.title,
            description: seed.description,
            language: seed.language,
            contentLocales: seed.contentLocales,
            defaultContentLocale: seed.defaultContentLocale,
            sourceLocale: seed.defaultContentLocale,
            targetLocale: seed.defaultContentLocale,
            protectionMode: seed.protectionMode,
            tags: seed.tags,
            visual: seed.visual,
            sourceTemplateKey: seed.templateKey,
          });
          await tx.insert(notes).values(
            seed.cards.map((card) => ({
              id: card.noteId,
              deckId,
              fields: {
                front: card.front,
                back: card.back,
                translations: card.translations,
              },
              tags: [],
            })),
          );
          await tx.insert(cards).values(
            seed.cards.map((card, index) => ({
              id: card.id,
              deckId,
              noteId: card.noteId,
              front: card.front,
              back: card.back,
              translations: card.translations,
              position: index + 1,
            })),
          );
          idsByTemplate.set(currentTemplateId, deckId);
          installedDeckIds.push(deckId);
        }
      });
      return reply.code(existing.length ? 200 : 201).send({
        installedDeckIds,
        selectedDeckId: idsByTemplate.get(templateId)!,
      });
    },
  );

  app.post(
    "/decks/templates/europe",
    { preHandler: authenticate },
    async (request, reply) => {
      const seed = createEuropeDeckSeed();
      const deckId = createId();
      await db.transaction(async (tx) => {
        await tx.insert(decks).values({
          id: deckId,
          ownerId: request.user.id,
          title: seed.title,
          description: seed.description,
          language: seed.language,
          contentLocales: seed.contentLocales,
          defaultContentLocale: seed.defaultContentLocale,
          sourceLocale: seed.defaultContentLocale,
          targetLocale: seed.defaultContentLocale,
          protectionMode: seed.protectionMode,
          tags: seed.tags,
        });
        await tx.insert(notes).values(
          seed.cards.map((card) => ({
            id: card.noteId,
            deckId,
            fields: {
              front: card.front,
              back: card.back,
              translations: card.translations,
            },
            tags: [],
          })),
        );
        await tx.insert(cards).values(
          seed.cards.map((card, index) => ({
            id: card.id,
            deckId,
            noteId: card.noteId,
            front: card.front,
            back: card.back,
            translations: card.translations,
            position: index + 1,
          })),
        );
      });
      const [created] = await db
        .select()
        .from(decks)
        .where(eq(decks.id, deckId))
        .limit(1);
      return reply.code(201).send({ ...created, cards: seed.cards });
    },
  );

  app.get("/decks/:deckId", { preHandler: authenticate }, async (request) => {
    const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
    const query = deckCardPageQuerySchema.parse(request.query);
    const deck = await requireOwnedDeck(deckId, request.user.id);
    if (query.cardPage !== undefined) {
      return {
        ...deck,
        ...(await loadDeckCardPage(
          deckId,
          query.cardPage,
          query.cardPageSize,
          query.cardSearch,
        )),
      };
    }
    const deckCards = await db
      .select()
      .from(cards)
      .where(eq(cards.deckId, deckId))
      .orderBy(cards.position, cards.createdAt);
    return { ...deck, cards: deckCards };
  });

  app.patch(
    "/decks/:deckId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const input = deckUpdateSchema.parse(request.body);
      const ownedDeck = await requireOwnedDeck(deckId, request.user.id);
      const { version, ...changes } = input;
      deckInputSchema.parse({ ...ownedDeck, ...changes });
      if ("parentDeckId" in changes) {
        await requireValidParent(
          changes.parentDeckId ?? null,
          request.user.id,
          deckId,
        );
      }
      const [updated] = await db
        .update(decks)
        .set({ ...changes, version: version + 1, updatedAt: new Date() })
        .where(and(eq(decks.id, deckId), eq(decks.version, version)))
        .returning();
      if (!updated) {
        return reply
          .code(409)
          .send({ message: "Deck changed on another device" });
      }
      return updated;
    },
  );

  app.post(
    "/decks/:deckId/editor-commit",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const input = deckEditorCommitSchema.parse(request.body);
      const { mutationId: _mutationId, ...commitRequest } = input;
      const requestHash = createHash("sha256")
        .update(JSON.stringify(commitRequest))
        .digest("hex");
      const ownedDeck = await requireOwnedDeck(deckId, request.user.id);
      const { version, deck: changes } = input;
      const validatedDeck = deckInputSchema.parse({ ...ownedDeck, ...changes });
      if ("parentDeckId" in changes) {
        await requireValidParent(
          changes.parentDeckId ?? null,
          request.user.id,
          deckId,
        );
      }

      const validatePair = (
        kind: z.infer<typeof cardKindSchema>,
        frontInput: unknown,
        backInput: unknown,
      ) => {
        const front = validateCardContent(frontInput);
        const back = validateCardContent(backInput);
        if (!isValidCardContentPair(kind, front, back)) {
          throw Object.assign(
            new Error(
              kind === "EXPLANATION"
                ? "Explanations require an empty front and non-empty content"
                : "Questions require a front and either an answer or a cloze",
            ),
            { statusCode: 422 },
          );
        }
        return { front, back };
      };

      const createdCards = input.createdCards.map((card) => ({
        ...card,
        ...validatePair(card.kind, card.front, card.back),
      }));
      const updatedCards = input.updatedCards.map((card) => ({
        ...card,
        ...validatePair(card.kind, card.front, card.back),
      }));
      for (const card of createdCards) {
        requireAvailableTranslationLocales(
          card.translations,
          validatedDeck.contentLocales,
        );
      }

      const existingMutation = await db
        .select({ payload: syncMutations.payload })
        .from(syncMutations)
        .where(
          and(
            eq(syncMutations.userId, request.user.id),
            eq(syncMutations.mutationId, input.mutationId),
          ),
        )
        .limit(1);
      if (existingMutation.length > 0) {
        const payload = existingMutation[0]!.payload;
        const metadata =
          payload.payload && typeof payload.payload === "object"
            ? (payload.payload as Record<string, unknown>)
            : null;
        if (
          payload.entityId !== deckId ||
          metadata?.requestHash !== requestHash
        ) {
          return reply.code(409).send({ message: "Mutation ID already used" });
        }
        const current = await requireOwnedDeck(deckId, request.user.id);
        return {
          ...current,
          ...(await loadDeckCardPage(
            deckId,
            input.cardOrder.cardPage,
            input.cardOrder.cardPageSize,
            input.cardOrder.cardSearch,
          )),
        };
      }

      const committed = await db.transaction(async (tx) => {
        const [claimed] = await tx
          .insert(syncMutations)
          .values({
            userId: request.user.id,
            mutationId: input.mutationId,
            payload: {
              mutationId: input.mutationId,
              entityId: deckId,
              entityType: "DECK",
              operation: "UPSERT",
              baseVersion: version,
              payload: { kind: "EDITOR_COMMIT", requestHash },
              createdAt: new Date().toISOString(),
            },
          })
          .onConflictDoNothing()
          .returning({ mutationId: syncMutations.mutationId });
        if (!claimed) return null;

        const [updatedDeck] = await tx
          .update(decks)
          .set({ ...changes, version: version + 1, updatedAt: new Date() })
          .where(and(eq(decks.id, deckId), eq(decks.version, version)))
          .returning();
        if (!updatedDeck) {
          throw Object.assign(new Error("Deck changed on another device"), {
            statusCode: 409,
          });
        }

        const operationIds = [
          ...updatedCards.map(({ id }) => id),
          ...input.deletedCards.map(({ id }) => id),
        ];
        const operationCards = operationIds.length
          ? await tx
              .select()
              .from(cards)
              .where(
                and(eq(cards.deckId, deckId), inArray(cards.id, operationIds)),
              )
              .for("update")
          : [];
        if (operationCards.length !== operationIds.length) {
          throw Object.assign(new Error("Card changed on another device"), {
            statusCode: 409,
          });
        }
        const operationCardById = new Map(
          operationCards.map((card) => [card.id, card]),
        );
        for (const card of [...updatedCards, ...input.deletedCards]) {
          if (operationCardById.get(card.id)?.version !== card.version) {
            throw Object.assign(new Error("Card changed on another device"), {
              statusCode: 409,
            });
          }
        }

        const pageSearchCondition = cardSearchCondition(
          input.cardOrder.cardSearch,
        );
        const pageCards = await tx
          .select({
            id: cards.id,
            noteId: cards.noteId,
            position: cards.position,
          })
          .from(cards)
          .where(
            pageSearchCondition
              ? and(eq(cards.deckId, deckId), pageSearchCondition)
              : eq(cards.deckId, deckId),
          )
          .orderBy(cards.position, cards.createdAt)
          .limit(input.cardOrder.cardPageSize)
          .offset((input.cardOrder.cardPage - 1) * input.cardOrder.cardPageSize)
          .for("update");
        const deletedNoteIds = new Set(
          input.deletedCards.map(({ id }) => operationCardById.get(id)!.noteId),
        );
        if (
          updatedCards.some(({ id }) =>
            deletedNoteIds.has(operationCardById.get(id)!.noteId),
          )
        ) {
          throw Object.assign(
            new Error("A deleted note cannot also be updated"),
            { statusCode: 422 },
          );
        }
        const expectedOrderIds = [
          ...pageCards
            .filter(({ noteId }) => !deletedNoteIds.has(noteId))
            .map(({ id }) => id),
          ...createdCards.map(({ id }) => id),
        ];
        if (
          expectedOrderIds.length !== input.cardOrder.cardIds.length ||
          expectedOrderIds.some((id) => !input.cardOrder.cardIds.includes(id))
        ) {
          throw Object.assign(
            new Error("Card order must match the edited card page"),
            { statusCode: 422 },
          );
        }

        if (deletedNoteIds.size > 0) {
          await tx.delete(notes).where(inArray(notes.id, [...deletedNoteIds]));
        }

        for (const card of updatedCards) {
          const existing = operationCardById.get(card.id)!;
          const translations = localizedCardContentsSchema.parse({
            ...existing.translations,
            [validatedDeck.defaultContentLocale]: {
              front: card.front,
              back: card.back,
            },
          });
          requireAvailableTranslationLocales(
            translations,
            validatedDeck.contentLocales,
          );
          const [updated] = await tx
            .update(cards)
            .set({
              front: card.front,
              back: card.back,
              translations,
              kind: card.kind,
              linkedToPrevious: card.linkedToPrevious,
              version: card.version + 1,
              updatedAt: new Date(),
            })
            .where(and(eq(cards.id, card.id), eq(cards.version, card.version)))
            .returning({ id: cards.id });
          if (!updated) {
            throw Object.assign(new Error("Card changed on another device"), {
              statusCode: 409,
            });
          }
          await tx
            .update(notes)
            .set({
              fields: {
                front: card.front,
                back: card.back,
                translations,
              },
              tags: card.tags,
              version: existing.version + 1,
              updatedAt: new Date(),
            })
            .where(eq(notes.id, existing.noteId));
        }

        const [lastCard] = await tx
          .select({ position: cards.position })
          .from(cards)
          .where(eq(cards.deckId, deckId))
          .orderBy(desc(cards.position))
          .limit(1);
        const provisionalStart = lastCard?.position ?? 0;
        if (createdCards.length > 0) {
          await tx.insert(notes).values(
            createdCards.map((card) => ({
              id: card.noteId,
              deckId,
              fields: {
                front: card.front,
                back: card.back,
                translations: {
                  [validatedDeck.defaultContentLocale]: {
                    front: card.front,
                    back: card.back,
                  },
                },
              },
              tags: card.tags,
            })),
          );
          await tx.insert(cards).values(
            createdCards.map((card, index) => ({
              id: card.id,
              deckId,
              noteId: card.noteId,
              front: card.front,
              back: card.back,
              translations: {
                [validatedDeck.defaultContentLocale]: {
                  front: card.front,
                  back: card.back,
                },
              },
              kind: card.kind,
              position: provisionalStart + index + 1,
              linkedToPrevious: card.linkedToPrevious,
            })),
          );
        }

        if (input.cardOrder.cardIds.length > 0) {
          const reusablePositions = pageCards.map(({ position }) => position);
          const finalPositions = input.cardOrder.cardIds.map(
            (_, index) =>
              reusablePositions[index] ??
              provisionalStart + index - reusablePositions.length + 1,
          );
          const positionCases = sql.join(
            input.cardOrder.cardIds.map(
              (cardId, index) =>
                sql`when ${cardId} then ${finalPositions[index]!}`,
            ),
            sql.raw(" "),
          );
          await tx
            .update(cards)
            .set({
              position: sql<number>`case ${cards.id} ${positionCases} else ${cards.position} end`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(cards.deckId, deckId),
                inArray(cards.id, input.cardOrder.cardIds),
              ),
            );
          if (finalPositions[0] === 1) {
            await tx
              .update(cards)
              .set({ linkedToPrevious: false })
              .where(eq(cards.id, input.cardOrder.cardIds[0]!));
          }
        }
        return updatedDeck;
      });

      if (!committed) {
        const [concurrentMutation] = await db
          .select({ payload: syncMutations.payload })
          .from(syncMutations)
          .where(
            and(
              eq(syncMutations.userId, request.user.id),
              eq(syncMutations.mutationId, input.mutationId),
            ),
          )
          .limit(1);
        const metadata =
          concurrentMutation?.payload.payload &&
          typeof concurrentMutation.payload.payload === "object"
            ? (concurrentMutation.payload.payload as Record<string, unknown>)
            : null;
        if (
          concurrentMutation?.payload.entityId !== deckId ||
          metadata?.requestHash !== requestHash
        ) {
          return reply.code(409).send({ message: "Mutation ID already used" });
        }
        const current = await requireOwnedDeck(deckId, request.user.id);
        return {
          ...current,
          ...(await loadDeckCardPage(
            deckId,
            input.cardOrder.cardPage,
            input.cardOrder.cardPageSize,
            input.cardOrder.cardSearch,
          )),
        };
      }
      return {
        ...committed,
        ...(await loadDeckCardPage(
          deckId,
          input.cardOrder.cardPage,
          input.cardOrder.cardPageSize,
          input.cardOrder.cardSearch,
        )),
      };
    },
  );

  app.patch(
    "/decks/:deckId/favorite",
    { preHandler: authenticate },
    async (request) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const { favorite } = z
        .object({ favorite: z.boolean() })
        .parse(request.body);
      await requireOwnedDeck(deckId, request.user.id);
      const [updated] = await db
        .update(decks)
        .set({ favorite, updatedAt: new Date() })
        .where(eq(decks.id, deckId))
        .returning({ id: decks.id, favorite: decks.favorite });
      return updated;
    },
  );

  app.patch(
    "/decks/:deckId/visibility",
    { preHandler: authenticate },
    async (request) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const { hidden } = z.object({ hidden: z.boolean() }).parse(request.body);
      await requireOwnedDeck(deckId, request.user.id);
      const [updated] = await db
        .update(decks)
        .set({
          hiddenAt: hidden ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(decks.id, deckId))
        .returning({ id: decks.id, hiddenAt: decks.hiddenAt });
      return updated;
    },
  );

  app.delete(
    "/decks/:deckId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const hierarchy = await ownedDeckHierarchy(request.user.id);
      const deck = hierarchy.find((candidate) => candidate.id === deckId);
      if (!deck) {
        throw Object.assign(new Error("Deck not found"), { statusCode: 404 });
      }
      if (deck.archivedAt) return reply.code(204).send();
      const deckIds = [...deckDescendantIds(hierarchy, deckId)];
      await db
        .update(decks)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(eq(decks.ownerId, request.user.id), inArray(decks.id, deckIds)),
        );
      return reply.code(204).send();
    },
  );

  app.post(
    "/decks/:deckId/restore",
    { preHandler: authenticate },
    async (request) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const hierarchy = await ownedDeckHierarchy(request.user.id);
      const deck = hierarchy.find((candidate) => candidate.id === deckId);
      if (!deck) {
        throw Object.assign(new Error("Deck not found"), { statusCode: 404 });
      }
      if (!deck.archivedAt) return { restoredDeckIds: [] };
      const restoredIds = restorableDeckIds(hierarchy, deck.id);
      await db
        .update(decks)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(decks.ownerId, request.user.id),
            inArray(decks.id, [...restoredIds]),
          ),
        );
      return { restoredDeckIds: [...restoredIds] };
    },
  );

  app.delete(
    "/decks/:deckId/permanent",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const { hierarchy } = await requireOwnedArchivedDeck(
        deckId,
        request.user.id,
      );
      const deletedIds = [...deckDescendantIds(hierarchy, deckId)];
      const [publication] = await db
        .select({ id: publications.id })
        .from(publications)
        .where(inArray(publications.deckId, deletedIds))
        .limit(1);
      if (publication) {
        throw Object.assign(
          new Error(
            "Published or moderated decks must be withdrawn before permanent deletion",
          ),
          { statusCode: 409 },
        );
      }
      const deletedCards = await db
        .select({ id: cards.id })
        .from(cards)
        .where(inArray(cards.deckId, deletedIds));
      const deletedVirtualTargets = await db
        .select({ id: virtualStudyTargets.id })
        .from(virtualStudyTargets)
        .where(
          and(
            eq(virtualStudyTargets.userId, request.user.id),
            or(
              inArray(virtualStudyTargets.questionDeckId, deletedIds),
              inArray(virtualStudyTargets.answerDeckId, deletedIds),
            ),
          ),
        );
      const deletedCardIds = [
        ...deletedCards.map((card) => card.id),
        ...deletedVirtualTargets.map((target) => target.id),
      ];
      await db.transaction(async (tx) => {
        if (deletedCardIds.length) {
          await tx
            .delete(cardProgress)
            .where(
              and(
                eq(cardProgress.userId, request.user.id),
                inArray(cardProgress.cardId, deletedCardIds),
              ),
            );
          await tx
            .delete(reviewEvents)
            .where(
              and(
                eq(reviewEvents.userId, request.user.id),
                inArray(reviewEvents.cardId, deletedCardIds),
              ),
            );
        }
        await tx
          .delete(decks)
          .where(
            and(
              eq(decks.ownerId, request.user.id),
              inArray(decks.id, deletedIds),
            ),
          );
      });
      return reply.code(204).send();
    },
  );

  app.post(
    "/decks/:deckId/cards",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const input = cardInputSchema.parse(request.body);
      const ownedDeck = await requireOwnedDeck(deckId, request.user.id);
      requireAvailableTranslationLocales(
        input.translations,
        ownedDeck.contentLocales,
      );
      const front = validateCardContent(input.front);
      const back = validateCardContent(input.back);
      if (!isValidCardContentPair(input.kind, front, back)) {
        return reply.code(422).send({
          message:
            input.kind === "EXPLANATION"
              ? "Explanations require an empty front and non-empty content"
              : "Questions require a front and either an answer or a cloze",
        });
      }
      const translations = localizedCardContentsSchema.parse(
        Object.fromEntries(
          Object.entries(
            Object.keys(input.translations).length
              ? input.translations
              : {
                  [ownedDeck.defaultContentLocale]: { front, back },
                },
          ).map(([locale, content]) => [
            locale,
            {
              front: validateCardContent(content.front),
              back: validateCardContent(content.back),
            },
          ]),
        ),
      );
      const noteId = createId();
      const cardId = createId();
      const [lastCard] = await db
        .select({ position: cards.position })
        .from(cards)
        .where(eq(cards.deckId, deckId))
        .orderBy(desc(cards.position))
        .limit(1);
      const position = (lastCard?.position ?? 0) + 1;
      await db.transaction(async (tx) => {
        await tx.insert(notes).values({
          id: noteId,
          deckId,
          fields: { front, back, translations },
          tags: input.tags,
        });
        await tx.insert(cards).values({
          id: cardId,
          deckId,
          noteId,
          front,
          back,
          questionLocale: input.questionLocale,
          answerLocale: input.answerLocale,
          translations,
          kind: input.kind,
          position,
          linkedToPrevious: position > 1 && input.linkedToPrevious,
        });
        await tx
          .update(decks)
          .set({ version: ownedDeck.version + 1, updatedAt: new Date() })
          .where(eq(decks.id, deckId));
      });
      const [created] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, cardId))
        .limit(1);
      return reply.code(201).send(created);
    },
  );

  app.patch(
    "/decks/:deckId/cards/order",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      const input = cardOrderSchema.parse(request.body);
      const ownedDeck = await requireOwnedDeck(deckId, request.user.id);
      if (
        (input.cardPage === undefined) !==
        (input.cardPageSize === undefined)
      ) {
        return reply.code(422).send({
          message: "Card page and page size must be supplied together",
        });
      }
      const existingCardsQuery = db
        .select({ id: cards.id, position: cards.position })
        .from(cards)
        .where(eq(cards.deckId, deckId))
        .orderBy(cards.position, cards.createdAt);
      const existingCards =
        input.cardPage === undefined || input.cardPageSize === undefined
          ? await existingCardsQuery
          : await existingCardsQuery
              .limit(input.cardPageSize)
              .offset((input.cardPage - 1) * input.cardPageSize);
      const existingIds = new Set(existingCards.map(({ id }) => id));
      const submittedIds = new Set(input.cardIds);
      if (
        submittedIds.size !== input.cardIds.length ||
        submittedIds.size !== existingIds.size ||
        input.cardIds.some((id) => !existingIds.has(id))
      ) {
        return reply
          .code(422)
          .send({ message: "Card order must contain every deck card once" });
      }

      const updatedDeck = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(decks)
          .set({ version: input.version + 1, updatedAt: new Date() })
          .where(and(eq(decks.id, deckId), eq(decks.version, input.version)))
          .returning();
        if (!updated) return null;

        const availablePositions = existingCards.map(
          ({ position }) => position,
        );
        const positionCases = sql.join(
          input.cardIds.map(
            (cardId, index) =>
              sql`when ${cardId} then ${availablePositions[index]!}`,
          ),
          sql.raw(" "),
        );
        await tx
          .update(cards)
          .set({
            position: sql<number>`case ${cards.id} ${positionCases} else ${cards.position} end`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(cards.deckId, deckId), inArray(cards.id, input.cardIds)),
          );
        if (availablePositions[0] === 1) {
          await tx
            .update(cards)
            .set({ linkedToPrevious: false })
            .where(
              and(eq(cards.deckId, deckId), eq(cards.id, input.cardIds[0]!)),
            );
        }
        return updated;
      });
      if (!updatedDeck) {
        return reply
          .code(409)
          .send({ message: "Deck changed on another device" });
      }

      if (input.cardPage !== undefined && input.cardPageSize !== undefined) {
        return {
          ...updatedDeck,
          ...(await loadDeckCardPage(
            deckId,
            input.cardPage,
            input.cardPageSize,
          )),
        };
      }
      const orderedCards = await db
        .select()
        .from(cards)
        .where(eq(cards.deckId, deckId))
        .orderBy(cards.position, cards.createdAt);
      return { ...updatedDeck, cards: orderedCards };
    },
  );

  app.patch(
    "/decks/:deckId/cards/:cardId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId, cardId } = z
        .object({ deckId: z.uuid(), cardId: z.uuid() })
        .parse(request.params);
      const input = cardUpdateSchema.parse(request.body);
      const ownedDeck = await requireOwnedDeck(deckId, request.user.id);
      const [existing] = await db
        .select()
        .from(cards)
        .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
        .limit(1);
      if (!existing) {
        return reply.code(404).send({ message: "Card not found" });
      }
      requireAvailableTranslationLocales(
        input.translations ?? existing.translations,
        ownedDeck.contentLocales,
      );
      const front = validateCardContent(input.front);
      const back = validateCardContent(input.back);
      if (!isValidCardContentPair(input.kind, front, back)) {
        return reply.code(422).send({
          message:
            input.kind === "EXPLANATION"
              ? "Explanations require an empty front and non-empty content"
              : "Questions require a front and either an answer or a cloze",
        });
      }
      const translations = localizedCardContentsSchema.parse(
        Object.fromEntries(
          Object.entries(
            input.translations ?? {
              ...existing.translations,
              [ownedDeck.defaultContentLocale]: { front, back },
            },
          ).map(([locale, content]) => [
            locale,
            {
              front: validateCardContent(content.front),
              back: validateCardContent(content.back),
            },
          ]),
        ),
      );
      const [updated] = await db
        .update(cards)
        .set({
          front,
          back,
          questionLocale:
            input.questionLocale === undefined
              ? existing.questionLocale
              : input.questionLocale,
          answerLocale:
            input.answerLocale === undefined
              ? existing.answerLocale
              : input.answerLocale,
          translations,
          kind: input.kind,
          linkedToPrevious: existing.position > 1 && input.linkedToPrevious,
          version: input.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(cards.id, cardId), eq(cards.version, input.version)))
        .returning();
      if (!updated) {
        return reply
          .code(409)
          .send({ message: "Card changed on another device" });
      }
      await db
        .update(notes)
        .set({
          fields: { front, back, translations },
          tags: input.tags,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(notes.id, existing.noteId));
      return updated;
    },
  );

  app.delete(
    "/decks/:deckId/cards/:cardId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId, cardId } = z
        .object({ deckId: z.uuid(), cardId: z.uuid() })
        .parse(request.params);
      await requireOwnedDeck(deckId, request.user.id);
      const [card] = await db
        .select({ noteId: cards.noteId })
        .from(cards)
        .where(and(eq(cards.id, cardId), eq(cards.deckId, deckId)))
        .limit(1);
      if (!card) {
        return reply.code(404).send({ message: "Card not found" });
      }
      await db.delete(notes).where(eq(notes.id, card.noteId));
      return reply.code(204).send();
    },
  );
};
