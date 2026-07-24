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

export async function cacheDueCards(cards: DueCard[]) {
  const db = await database();
  const tx = db.transaction("due", "readwrite");
  await tx.store.clear();
  await Promise.all(cards.map((card) => tx.store.put(card)));
  await tx.done;
}

export async function getCachedDueCards(): Promise<DueCard[]> {
  return (await database()).getAll("due");
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
