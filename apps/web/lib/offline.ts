"use client";

import { openDB } from "idb";

import type { DueCard } from "@flashcards/api-client";
import type { ReviewRating } from "@flashcards/domain";

export type QueuedReview = {
  mutationId: string;
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
  timezone: string;
};

const database = () =>
  openDB("flora-offline-v1", 1, {
    upgrade(db) {
      db.createObjectStore("due", { keyPath: "card.id" });
      db.createObjectStore("reviews", { keyPath: "mutationId" });
      db.createObjectStore("meta");
    },
  });

export async function cacheDueCards(cards: DueCard[], deckId?: string) {
  const db = await database();
  const tx = db.transaction("due", "readwrite");
  if (deckId) {
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if (cursor.value.card.deckId === deckId) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
  } else {
    await tx.store.clear();
  }
  await Promise.all(cards.map((card) => tx.store.put(card)));
  await tx.done;
}

export async function getCachedDueCards(deckId?: string): Promise<DueCard[]> {
  const cards: DueCard[] = await (await database()).getAll("due");
  return deckId ? cards.filter((card) => card.card.deckId === deckId) : cards;
}

export async function queueReview(review: QueuedReview) {
  const db = await database();
  await db.put("reviews", review);
  await db.delete("due", review.cardId);
}

export async function queuedReviews(): Promise<QueuedReview[]> {
  return (await database()).getAll("reviews");
}

export async function acknowledgeReview(mutationId: string) {
  await (await database()).delete("reviews", mutationId);
}

export async function flushReviews(
  send: (review: QueuedReview) => Promise<unknown>,
) {
  for (const review of await queuedReviews()) {
    await send(review);
    await acknowledgeReview(review.mutationId);
  }
}

export async function clearDueCache() {
  await (await database()).clear("due");
}

export async function removeCachedDueDecks(deckIds: Iterable<string>) {
  const selected = new Set(deckIds);
  if (!selected.size) return;
  const db = await database();
  const tx = db.transaction(["due", "meta"], "readwrite");
  const removedCardIds = new Set<string>();
  let cursor = await tx.objectStore("due").openCursor();
  while (cursor) {
    if (selected.has(cursor.value.card.deckId)) {
      removedCardIds.add(cursor.value.card.id);
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  let metaCursor = await tx.objectStore("meta").openCursor();
  while (metaCursor) {
    if (
      typeof metaCursor.key === "string" &&
      metaCursor.key.startsWith("due-scope:") &&
      Array.isArray(metaCursor.value)
    ) {
      await metaCursor.update(
        metaCursor.value.filter(
          (cardId: unknown) =>
            typeof cardId === "string" && !removedCardIds.has(cardId),
        ),
      );
    }
    metaCursor = await metaCursor.continue();
  }
  await tx.done;
}

export async function clearOfflineData() {
  const db = await database();
  const tx = db.transaction(["due", "reviews", "meta"], "readwrite");
  await Promise.all([
    tx.objectStore("due").clear(),
    tx.objectStore("reviews").clear(),
    tx.objectStore("meta").clear(),
  ]);
  await tx.done;
  db.close();
}
