import { and, eq, inArray } from "drizzle-orm";

import { createId } from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";

import type { db as database } from "../db/client.js";
import { cards, decks, notes } from "../db/schema.js";
import { stableTemplateUuid } from "./core-language-deck.js";

export type VirtualCollectionCardSeed = {
  key: string;
  front: CardContent;
  back: CardContent;
  questionLocale: string;
  answerLocale: string;
};

export type VirtualCollectionDeckSeed = {
  key: string;
  parentKey: string | null;
  title: string;
  description: string;
  sourceLocale: string;
  targetLocale: string;
  contentLocales: string[];
  tags: string[];
  cards: VirtualCollectionCardSeed[];
};

export async function syncVirtualCollectionForOwner(
  db: typeof database,
  ownerId: string,
  seeds: readonly VirtualCollectionDeckSeed[],
) {
  const keys = seeds.map((seed) => seed.key);
  const existing = await db
    .select({ id: decks.id, sourceTemplateKey: decks.sourceTemplateKey })
    .from(decks)
    .where(
      and(eq(decks.ownerId, ownerId), inArray(decks.sourceTemplateKey, keys)),
    );
  const idsByKey = new Map(
    existing.map((deck) => [deck.sourceTemplateKey!, deck.id]),
  );

  await db.transaction(async (tx) => {
    for (const seed of seeds) {
      const parentDeckId = seed.parentKey
        ? (idsByKey.get(seed.parentKey) ?? null)
        : null;
      let deckId = idsByKey.get(seed.key);
      const deckValues = {
        parentDeckId,
        title: seed.title,
        description: seed.description,
        language: seed.sourceLocale,
        contentLocales: seed.contentLocales,
        defaultContentLocale: seed.sourceLocale,
        sourceLocale: seed.sourceLocale,
        targetLocale: seed.targetLocale,
        protectionMode: "ACCOUNT_BOUND" as const,
        tags: seed.tags,
        sourceTemplateKey: seed.key,
      };
      if (!deckId) {
        deckId = createId();
        await tx.insert(decks).values({ id: deckId, ownerId, ...deckValues });
        idsByKey.set(seed.key, deckId);
      } else {
        await tx
          .update(decks)
          .set({
            ...deckValues,
            archivedAt: null,
            hiddenAt: null,
            updatedAt: new Date(),
          })
          .where(eq(decks.id, deckId));
      }

      for (const [position, cardSeed] of seed.cards.entries()) {
        const noteId = stableTemplateUuid(
          deckId,
          `virtual-note:${cardSeed.key}`,
        );
        const cardId = stableTemplateUuid(
          deckId,
          `virtual-card:${cardSeed.key}`,
        );
        const fields = { providerKey: cardSeed.key };
        await tx
          .insert(notes)
          .values({
            id: noteId,
            deckId,
            fields,
            tags: [cardSeed.key],
          })
          .onConflictDoUpdate({
            target: notes.id,
            set: {
              deckId,
              fields,
              tags: [cardSeed.key],
              updatedAt: new Date(),
            },
          });
        await tx
          .insert(cards)
          .values({
            id: cardId,
            deckId,
            noteId,
            front: cardSeed.front,
            back: cardSeed.back,
            questionLocale: cardSeed.questionLocale,
            answerLocale: cardSeed.answerLocale,
            position: position + 1,
          })
          .onConflictDoUpdate({
            target: cards.id,
            set: {
              deckId,
              noteId,
              front: cardSeed.front,
              back: cardSeed.back,
              questionLocale: cardSeed.questionLocale,
              answerLocale: cardSeed.answerLocale,
              position: position + 1,
              updatedAt: new Date(),
            },
          });
      }
    }
  });

  return {
    createdDeckCount: seeds.length - existing.length,
    idsByKey,
  };
}
