import { eq, sql } from "drizzle-orm";

import {
  cardContentSchema,
  type CardContent,
} from "@flashcards/domain/content";

import type { db as database } from "../db/client.js";
import { cards, notes } from "../db/schema.js";
import { stripEmptyAnkiPlaceholders } from "./anki-repair.js";

const placeholderSearch = "%Nicht unterstützter Anki-Inhalt.%";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasAnkiSource = (value: unknown): boolean =>
  isRecord(value) && isRecord(value.ankiSource);

export function repairPersistedAnkiCard(input: {
  front: unknown;
  back: unknown;
  noteFields: unknown;
}): { front: CardContent; back: CardContent } | null {
  if (!hasAnkiSource(input.noteFields)) return null;
  const front = cardContentSchema.safeParse(input.front);
  const back = cardContentSchema.safeParse(input.back);
  if (!front.success || !back.success) return null;
  const repairedFront = stripEmptyAnkiPlaceholders(front.data);
  const repairedBack = stripEmptyAnkiPlaceholders(back.data);
  if (repairedFront === front.data && repairedBack === back.data) return null;
  return { front: repairedFront, back: repairedBack };
}

export async function migratePersistedAnkiPlaceholders(
  db: typeof database,
): Promise<number> {
  let repaired = 0;
  await db.transaction(async (tx) => {
    const importedCards = await tx
      .select({
        id: cards.id,
        front: cards.front,
        back: cards.back,
        noteFields: notes.fields,
      })
      .from(cards)
      .innerJoin(notes, eq(notes.id, cards.noteId))
      .where(
        sql`(${cards.front}::text LIKE ${placeholderSearch} OR ${cards.back}::text LIKE ${placeholderSearch})`,
      );

    for (const card of importedCards) {
      const next = repairPersistedAnkiCard(card);
      if (!next) continue;
      await tx
        .update(cards)
        .set({
          front: next.front,
          back: next.back,
          version: sql`${cards.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, card.id));
      repaired += 1;
    }
  });
  return repaired;
}
