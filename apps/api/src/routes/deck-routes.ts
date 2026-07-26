import { and, count, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { createId } from "@flashcards/domain";
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

const deckInputShape = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).default(""),
  language: contentLocaleSchema.default("en"),
  contentLocales: z.array(contentLocaleSchema).min(1).max(20).default(["en"]),
  defaultContentLocale: contentLocaleSchema.default("en"),
  protectionMode: z
    .enum(["STANDARD", "ACCOUNT_BOUND"])
    .default("ACCOUNT_BOUND"),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
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

export const registerDeckRoutes = async (
  app: FastifyInstance,
): Promise<void> => {
  app.get("/decks", { preHandler: authenticate }, async (request) => {
    return db
      .select({
        id: decks.id,
        title: decks.title,
        description: decks.description,
        language: decks.language,
        contentLocales: decks.contentLocales,
        defaultContentLocale: decks.defaultContentLocale,
        protectionMode: decks.protectionMode,
        tags: decks.tags,
        version: decks.version,
        updatedAt: decks.updatedAt,
        cardCount: count(cards.id),
      })
      .from(decks)
      .leftJoin(cards, eq(cards.deckId, decks.id))
      .where(and(eq(decks.ownerId, request.user.id), isNull(decks.archivedAt)))
      .groupBy(decks.id)
      .orderBy(decks.updatedAt);
  });

  app.post("/decks", { preHandler: authenticate }, async (request, reply) => {
    const input = deckInputSchema.parse(request.body);
    const id = createId();
    const [deck] = await db
      .insert(decks)
      .values({ id, ownerId: request.user.id, ...input })
      .returning();
    return reply.code(201).send(deck);
  });

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

  app.delete(
    "/decks/:deckId",
    { preHandler: authenticate },
    async (request, reply) => {
      const { deckId } = z.object({ deckId: z.uuid() }).parse(request.params);
      await requireOwnedDeck(deckId, request.user.id);
      await db
        .update(decks)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(decks.id, deckId));
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
