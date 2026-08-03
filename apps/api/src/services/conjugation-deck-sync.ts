import { and, eq, inArray, sql } from "drizzle-orm";

import { createId } from "@flashcards/domain";

import type { db as database } from "../db/client.js";
import { cards, decks, notes } from "../db/schema.js";
import { createConjugationCollectionDeckSeeds } from "./conjugation-deck.js";
import { planGermanVerbCardSync } from "./german-verb-deck-sync.js";

export type ConjugationDeckSyncResult = {
  createdDeckCount: number;
  idsByKey: Map<string, string>;
};

export async function syncConjugationDecksForOwner(
  db: typeof database,
  ownerId: string,
  options: {
    createMissing?: boolean;
    restoreVisibility?: boolean;
  } = {},
): Promise<ConjugationDeckSyncResult> {
  const createMissing = options.createMissing ?? true;
  const restoreVisibility = options.restoreVisibility ?? true;
  const seeds = createConjugationCollectionDeckSeeds();
  const keys = seeds.map((seed) => seed.key);
  const existing = await db
    .select({
      id: decks.id,
      sourceTemplateKey: decks.sourceTemplateKey,
    })
    .from(decks)
    .where(
      and(eq(decks.ownerId, ownerId), inArray(decks.sourceTemplateKey, keys)),
    );
  const idsByKey = new Map(
    existing.map((deck) => [deck.sourceTemplateKey!, deck.id]),
  );
  let createdDeckCount = 0;

  await db.transaction(async (tx) => {
    for (const seed of seeds) {
      const parentDeckId = seed.parentKey
        ? (idsByKey.get(seed.parentKey) ?? null)
        : null;
      let deckId = idsByKey.get(seed.key);
      if (!deckId) {
        if (!createMissing) continue;
        deckId = createId();
        await tx.insert(decks).values({
          id: deckId,
          ownerId,
          parentDeckId,
          title: seed.title,
          description: seed.description,
          language: seed.locale,
          contentLocales: seed.contentLocales,
          defaultContentLocale: seed.locale,
          sourceLocale: seed.locale,
          targetLocale: seed.locale,
          studyOrder: seed.studyOrder,
          protectionMode: "ACCOUNT_BOUND",
          tags: seed.tags,
          sourceTemplateKey: seed.key,
        });
        idsByKey.set(seed.key, deckId);
        createdDeckCount += 1;
      } else {
        await tx
          .update(decks)
          .set({
            parentDeckId,
            title: seed.title,
            description: seed.description,
            language: seed.locale,
            contentLocales: seed.contentLocales,
            defaultContentLocale: seed.locale,
            sourceLocale: seed.locale,
            targetLocale: seed.locale,
            studyOrder: seed.studyOrder,
            tags: seed.tags,
            ...(restoreVisibility ? { archivedAt: null, hiddenAt: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(decks.id, deckId));
      }

      if (!seed.cards.length) continue;
      const persistedCards = await tx
        .select({
          cardId: cards.id,
          noteId: cards.noteId,
          position: cards.position,
          tags: notes.tags,
        })
        .from(cards)
        .innerJoin(notes, eq(cards.noteId, notes.id))
        .where(eq(cards.deckId, deckId))
        .orderBy(cards.position);
      const syncPlan = planGermanVerbCardSync(seed, persistedCards);
      const updatedAt = new Date();
      for (const entry of syncPlan) {
        const fields = {
          front: entry.seed.front,
          back: entry.seed.back,
          translations: {},
        };
        if (entry.existing) {
          const tags = entry.existing.tags.includes(entry.tag)
            ? entry.existing.tags
            : [...entry.existing.tags, entry.tag];
          await tx
            .update(notes)
            .set({
              deckId,
              fields,
              tags,
              version: sql`${notes.version} + 1`,
              updatedAt,
            })
            .where(eq(notes.id, entry.existing.noteId));
          await tx
            .update(cards)
            .set({
              deckId,
              noteId: entry.existing.noteId,
              front: entry.seed.front,
              back: entry.seed.back,
              translations: {},
              position: entry.position,
              version: sql`${cards.version} + 1`,
              updatedAt,
            })
            .where(eq(cards.id, entry.existing.cardId));
          continue;
        }
        await tx.insert(notes).values({
          id: entry.seed.noteId,
          deckId,
          fields,
          tags: [entry.tag],
        });
        await tx.insert(cards).values({
          id: entry.seed.id,
          deckId,
          noteId: entry.seed.noteId,
          front: entry.seed.front,
          back: entry.seed.back,
          translations: {},
          position: entry.position,
        });
      }
    }
  });

  return { createdDeckCount, idsByKey };
}
