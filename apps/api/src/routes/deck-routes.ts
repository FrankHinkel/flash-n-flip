import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId, geographyRegions } from "@flashcards/domain";
import {
  cardContentSchema,
  contentLocaleSchema,
  localizedCardContentsSchema,
  validateCardContent,
} from "@flashcards/domain/content";

import { authenticate } from "../auth.js";
import { db } from "../db/client.js";
import { cards, decks, notes } from "../db/schema.js";
import { createEuropeDeckSeed } from "../services/europe-deck.js";
import {
  createGeographyDeckSeed,
  geographyTemplateKey,
  geographyTemplates,
  type GeographyTemplateId,
} from "../services/geography-decks.js";

const templateIdSchema = z.enum([
  "world",
  "europe",
  "north-america",
  "south-america",
  "asia",
  "africa",
  "oceania",
]);

const deckInputShape = {
  parentDeckId: z.uuid().nullable().default(null),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  language: contentLocaleSchema.default("en"),
  contentLocales: z.array(contentLocaleSchema).min(1).max(20).default(["en"]),
  defaultContentLocale: contentLocaleSchema.default("en"),
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
    ])
    .nullable()
    .default(null),
};

const deckInputSchema = z
  .object(deckInputShape)
  .refine(
    (input) => input.contentLocales.includes(input.defaultContentLocale),
    {
      path: ["defaultContentLocale"],
      message: "Default content locale must be available in the deck",
    },
  );

const deckUpdateSchema = z.object(deckInputShape).partial().extend({
  version: z.number().int().positive(),
});

const cardInputSchema = z.object({
  front: cardContentSchema,
  back: cardContentSchema,
  translations: localizedCardContentsSchema.default({}),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
});

const cardUpdateSchema = z.object({
  front: cardContentSchema,
  back: cardContentSchema,
  translations: localizedCardContentsSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  version: z.number().int().positive(),
});

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

const ownedDeckDescendantIds = async (deckId: string, userId: string) => {
  const owned = await db
    .select({ id: decks.id, parentDeckId: decks.parentDeckId })
    .from(decks)
    .where(and(eq(decks.ownerId, userId), isNull(decks.archivedAt)));
  if (!owned.some((deck) => deck.id === deckId)) {
    throw Object.assign(new Error("Deck not found"), { statusCode: 404 });
  }
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

export const registerDeckRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/decks", { preHandler: authenticate }, async (request) => {
    const { includeHidden } = z
      .object({
        includeHidden: z
          .enum(["true", "false"])
          .optional()
          .transform((value) => value === "true"),
      })
      .parse(request.query);
    return db
      .select({
        id: decks.id,
        parentDeckId: decks.parentDeckId,
        title: decks.title,
        description: decks.description,
        language: decks.language,
        contentLocales: decks.contentLocales,
        defaultContentLocale: decks.defaultContentLocale,
        protectionMode: decks.protectionMode,
        tags: decks.tags,
        favorite: decks.favorite,
        hiddenAt: decks.hiddenAt,
        visual: decks.visual,
        sourceTemplateKey: decks.sourceTemplateKey,
        version: decks.version,
        updatedAt: decks.updatedAt,
        cardCount: count(cards.id),
      })
      .from(decks)
      .leftJoin(cards, eq(cards.deckId, decks.id))
      .where(
        and(
          eq(decks.ownerId, request.user.id),
          isNull(decks.archivedAt),
          ...(includeHidden ? [] : [isNull(decks.hiddenAt)]),
        ),
      )
      .groupBy(decks.id)
      .orderBy(decks.updatedAt);
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
    "/decks/templates/geography",
    { preHandler: authenticate },
    async (request) => {
      const templateKeys = geographyTemplates.map((template) =>
        geographyTemplateKey(template.id),
      );
      const installed = await db
        .select({
          id: decks.id,
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
      const installedByKey = new Map(
        installed.map((deck) => [deck.sourceTemplateKey, deck.id]),
      );
      return geographyTemplates.map((template) => ({
        id: template.id,
        parentId: template.parentId,
        titles: template.titles,
        descriptions: template.descriptions,
        visual:
          template.id === "world"
            ? { kind: "GLOBE" as const, value: "world" as const }
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
      const requested: GeographyTemplateId[] =
        templateId === "world" && includeChildren
          ? geographyTemplates.map((template) => template.id)
          : templateId === "world"
            ? ["world"]
            : ["world", templateId];
      const requestedKeys = requested.map(geographyTemplateKey);
      const existing = await db
        .select({
          id: decks.id,
          sourceTemplateKey: decks.sourceTemplateKey,
          archivedAt: decks.archivedAt,
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
      for (const deck of existing) {
        const template = geographyTemplates.find(
          (item) => geographyTemplateKey(item.id) === deck.sourceTemplateKey,
        );
        if (template) {
          idsByTemplate.set(template.id, deck.id);
          if (deck.archivedAt) archivedTemplateIds.add(template.id);
        }
      }
      const installedDeckIds: string[] = [];
      await db.transaction(async (tx) => {
        for (const currentTemplateId of requested) {
          const existingId = idsByTemplate.get(currentTemplateId);
          if (existingId) {
            if (archivedTemplateIds.has(currentTemplateId)) {
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
            seed.cards.map((card) => ({
              id: card.id,
              deckId,
              noteId: card.noteId,
              front: card.front,
              back: card.back,
              translations: card.translations,
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
          seed.cards.map((card) => ({
            id: card.id,
            deckId,
            noteId: card.noteId,
            front: card.front,
            back: card.back,
            translations: card.translations,
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
    const deck = await requireOwnedDeck(deckId, request.user.id);
    const deckCards = await db
      .select()
      .from(cards)
      .where(eq(cards.deckId, deckId))
      .orderBy(cards.createdAt);
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
      const deckIds = await ownedDeckDescendantIds(deckId, request.user.id);
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
          translations,
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
          translations,
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
