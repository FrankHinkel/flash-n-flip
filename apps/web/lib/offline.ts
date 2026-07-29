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
  const tx = db.transaction(["due", "meta"], "readwrite");
  const dueStore = tx.objectStore("due");
  const metaStore = tx.objectStore("meta");
  if (deckId) {
    await metaStore.put(
      cards.map((card) => card.card.id),
      `due-scope:${deckId}`,
    );
  } else {
    await dueStore.clear();
    await metaStore.clear();
  }
  await metaStore.put(
    cards.map((card) => card.card.id),
    `due-order:${deckId ?? "all"}`,
  );
  await Promise.all(cards.map((card) => dueStore.put(card)));
  await tx.done;
}

export async function getCachedDueCards(deckId?: string): Promise<DueCard[]> {
  const db = await database();
  const cards: DueCard[] = await db.getAll("due");
  const scopedCardIds = deckId
    ? ((await db.get("meta", `due-scope:${deckId}`)) as string[] | undefined)
    : undefined;
  const selected = selectCachedDueCards(cards, deckId, scopedCardIds);
  const order = (await db.get("meta", `due-order:${deckId ?? "all"}`)) as
    string[] | undefined;
  return orderCachedDueCards(selected, order);
}

export const selectCachedDueCards = (
  cards: DueCard[],
  deckId?: string,
  scopedCardIds?: string[],
): DueCard[] => {
  if (!deckId) return cards;
  if (scopedCardIds) {
    const selected = new Set(scopedCardIds);
    return cards.filter((card) => selected.has(card.card.id));
  }
  return cards.filter((card) => card.card.deckId === deckId);
};

export const orderCachedDueCards = (
  cards: DueCard[],
  cardIds?: string[],
): DueCard[] => {
  if (!cardIds) return cards;
  const byId = new Map(cards.map((card) => [card.card.id, card]));
  const ordered = cardIds.flatMap((cardId) => {
    const card = byId.get(cardId);
    return card ? [card] : [];
  });
  const orderedIds = new Set(cardIds);
  return [...ordered, ...cards.filter((card) => !orderedIds.has(card.card.id))];
};

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
      (metaCursor.key.startsWith("due-scope:") ||
        metaCursor.key.startsWith("due-order:")) &&
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
