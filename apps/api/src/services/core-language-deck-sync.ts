import { and, eq, inArray } from "drizzle-orm";

import { createId } from "@flashcards/domain";

import type { db as database } from "../db/client.js";
import { cards, decks, notes } from "../db/schema.js";
import {
  coreLanguageLocales,
  coreLanguageMatrixTag,
  createCoreLanguageDeckSeeds,
  stableTemplateUuid,
} from "./core-language-deck.js";

export type CoreLanguageDeckSyncResult = {
  createdDeckCount: number;
  idsByKey: Map<string, string>;
};

export async function syncCoreLanguageDecksForOwner(
  db: typeof database,
  ownerId: string,
  options: {
    createMissing?: boolean;
    restoreVisibility?: boolean;
  } = {},
): Promise<CoreLanguageDeckSyncResult> {
  const createMissing = options.createMissing ?? true;
  const restoreVisibility = options.restoreVisibility ?? true;
  const seeds = createCoreLanguageDeckSeeds();
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
          language: "en",
          contentLocales: [...coreLanguageLocales],
          defaultContentLocale: "en",
          sourceLocale: "de",
          targetLocale: "en",
          protectionMode: "ACCOUNT_BOUND",
          tags: [
            "Core 100",
            "English",
            "Deutsch",
            "Français",
            "Español",
            coreLanguageMatrixTag,
          ],
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
            contentLocales: [...coreLanguageLocales],
            defaultContentLocale: "en",
            sourceLocale: "de",
            targetLocale: "en",
            tags: [
              "Core 100",
              "English",
              "Deutsch",
              "Français",
              "Español",
              coreLanguageMatrixTag,
            ],
            ...(restoreVisibility ? { archivedAt: null, hiddenAt: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(decks.id, deckId));
      }

      for (const [index, item] of seed.cards.entries()) {
        const noteId = stableTemplateUuid(
          deckId,
          `core-language-note:${item.conceptKey}`,
        );
        const cardId = stableTemplateUuid(
          deckId,
          `core-language-card:${item.conceptKey}`,
        );
        const fields = {
          front: item.front,
          back: item.back,
          translations: item.translations,
          conceptKey: item.conceptKey,
        };
        await tx
          .insert(notes)
          .values({
            id: noteId,
            deckId,
            fields,
            tags: [item.conceptKey],
          })
          .onConflictDoUpdate({
            target: notes.id,
            set: {
              deckId,
              fields,
              tags: [item.conceptKey],
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
            translations: item.translations,
            position: index + 1,
          })
          .onConflictDoUpdate({
            target: cards.id,
            set: {
              deckId,
              noteId,
              front: item.front,
              back: item.back,
              translations: item.translations,
              position: index + 1,
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

export async function refreshInstalledCoreLanguageDecks(
  db: typeof database,
): Promise<number> {
  const templateKeys = createCoreLanguageDeckSeeds().map((seed) => seed.key);
  const installations = await db
    .selectDistinct({ ownerId: decks.ownerId })
    .from(decks)
    .where(inArray(decks.sourceTemplateKey, templateKeys));

  for (const installation of installations) {
    await syncCoreLanguageDecksForOwner(db, installation.ownerId, {
      createMissing: false,
      restoreVisibility: false,
    });
  }
  return installations.length;
}
