import { eq } from "drizzle-orm";

import {
  cardContentSchema,
  migrateCardContentToMarkdown,
  migrateGfmTablesToWikiTables,
  repairDuplicateMarkdownClozePositions,
  type CardContent,
} from "@flashcards/domain/content";

import type { db as database } from "../db/client.js";
import { cards, cardTemplates, notes, revisionCards } from "../db/schema.js";

export function migrateUnknownCardContent(
  value: unknown,
): CardContent | unknown {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !Array.isArray((value as { blocks?: unknown }).blocks)
  ) {
    return value;
  }
  const blocks = (value as { blocks: Array<Record<string, unknown>> }).blocks;
  const hasLegacyRichText = blocks.some((block) => block?.type === "richText");
  if (!hasLegacyRichText) {
    let repaired = false;
    const nextBlocks = blocks.map((block) => {
      if (block?.type !== "markdown" || typeof block.source !== "string") {
        return block;
      }
      const positionRepair = repairDuplicateMarkdownClozePositions(
        block.source,
      );
      const migrated = migrateGfmTablesToWikiTables(positionRepair.source);
      if (!positionRepair.changed && !migrated.changed) return block;
      repaired = true;
      return { ...block, source: migrated.source };
    });
    return repaired ? { ...(value as object), blocks: nextBlocks } : value;
  }
  const parsed = cardContentSchema.safeParse(value);
  if (!parsed.success) return value;
  return migrateUnknownCardContent(migrateCardContentToMarkdown(parsed.data));
}

export function migrateCardTranslations(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([locale, localized]) => {
      if (
        !localized ||
        typeof localized !== "object" ||
        Array.isArray(localized)
      ) {
        return [locale, localized];
      }
      const entry = localized as Record<string, unknown>;
      return [
        locale,
        {
          ...entry,
          front: migrateUnknownCardContent(entry.front),
          back: migrateUnknownCardContent(entry.back),
        },
      ];
    }),
  );
}

export function migrateNoteFields(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const fields = value as Record<string, unknown>;
  return {
    ...fields,
    front: migrateUnknownCardContent(fields.front),
    back: migrateUnknownCardContent(fields.back),
    translations: migrateCardTranslations(fields.translations),
  };
}

const changed = (before: unknown, after: unknown): boolean =>
  JSON.stringify(before) !== JSON.stringify(after);

export async function migratePersistedMarkdownContent(
  db: typeof database,
): Promise<number> {
  let updates = 0;
  await db.transaction(async (tx) => {
    const storedCards = await tx
      .select({
        id: cards.id,
        front: cards.front,
        back: cards.back,
        translations: cards.translations,
      })
      .from(cards);
    for (const card of storedCards) {
      const front = migrateUnknownCardContent(card.front);
      const back = migrateUnknownCardContent(card.back);
      const translations = migrateCardTranslations(card.translations);
      if (
        changed(card.front, front) ||
        changed(card.back, back) ||
        changed(card.translations, translations)
      ) {
        await tx
          .update(cards)
          .set({
            front: front as Record<string, unknown>,
            back: back as Record<string, unknown>,
            translations: translations as typeof card.translations,
          })
          .where(eq(cards.id, card.id));
        updates += 1;
      }
    }

    const storedNotes = await tx
      .select({ id: notes.id, fields: notes.fields })
      .from(notes);
    for (const note of storedNotes) {
      const fields = migrateNoteFields(note.fields);
      if (changed(note.fields, fields)) {
        await tx
          .update(notes)
          .set({ fields: fields as Record<string, unknown> })
          .where(eq(notes.id, note.id));
        updates += 1;
      }
    }

    const templates = await tx
      .select({
        id: cardTemplates.id,
        front: cardTemplates.front,
        back: cardTemplates.back,
      })
      .from(cardTemplates);
    for (const template of templates) {
      const front = migrateUnknownCardContent(template.front);
      const back = migrateUnknownCardContent(template.back);
      if (changed(template.front, front) || changed(template.back, back)) {
        await tx
          .update(cardTemplates)
          .set({
            front: front as Record<string, unknown>,
            back: back as Record<string, unknown>,
          })
          .where(eq(cardTemplates.id, template.id));
        updates += 1;
      }
    }

    const revisions = await tx
      .select({
        id: revisionCards.id,
        front: revisionCards.front,
        back: revisionCards.back,
      })
      .from(revisionCards);
    for (const revision of revisions) {
      const front = migrateUnknownCardContent(revision.front);
      const back = migrateUnknownCardContent(revision.back);
      if (changed(revision.front, front) || changed(revision.back, back)) {
        await tx
          .update(revisionCards)
          .set({
            front: front as Record<string, unknown>,
            back: back as Record<string, unknown>,
          })
          .where(eq(revisionCards.id, revision.id));
        updates += 1;
      }
    }
  });
  return updates;
}
