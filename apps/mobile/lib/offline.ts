import * as SQLite from "expo-sqlite";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

export type OfflineReview = {
  mutationId: string;
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
  timezone: string;
};

let database: Promise<SQLite.SQLiteDatabase> | null = null;

async function db() {
  database ??= SQLite.openDatabaseAsync("flora.db");
  const value = await database;
  await value.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS due_cards (
      card_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_outbox (
      mutation_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return value;
}

export async function replaceDueCards(cards: DueCard[]) {
  const value = await db();
  await value.withTransactionAsync(async () => {
    await value.runAsync("DELETE FROM due_cards");
    for (const card of cards) {
      await value.runAsync(
        "INSERT INTO due_cards (card_id, payload, cached_at) VALUES (?, ?, ?)",
        card.card.id,
        JSON.stringify(card),
        new Date().toISOString(),
      );
    }
  });
}

export async function cachedDueCards(): Promise<DueCard[]> {
  const rows = await (
    await db()
  ).getAllAsync<{ payload: string }>(
    "SELECT payload FROM due_cards ORDER BY cached_at",
  );
  return rows.map((row) => JSON.parse(row.payload) as DueCard);
}

export async function removeCachedDueDecks(deckIds: Iterable<string>) {
  const selected = new Set(deckIds);
  if (!selected.size) return;
  const remaining = (await cachedDueCards()).filter(
    (card) => !selected.has(card.card.deckId),
  );
  await replaceDueCards(remaining);
}

export async function enqueueReview(review: OfflineReview) {
  const value = await db();
  await value.runAsync(
    "INSERT OR REPLACE INTO review_outbox (mutation_id, payload, created_at) VALUES (?, ?, ?)",
    review.mutationId,
    JSON.stringify(review),
    review.reviewedAt,
  );
  await value.runAsync(
    "DELETE FROM due_cards WHERE card_id = ?",
    review.cardId,
  );
}

export async function flushReviewOutbox(
  send: (review: OfflineReview) => Promise<unknown>,
) {
  const value = await db();
  const rows = await value.getAllAsync<{
    mutation_id: string;
    payload: string;
  }>("SELECT mutation_id, payload FROM review_outbox ORDER BY created_at");
  for (const row of rows) {
    await send(JSON.parse(row.payload) as OfflineReview);
    await value.runAsync(
      "DELETE FROM review_outbox WHERE mutation_id = ?",
      row.mutation_id,
    );
  }
}
