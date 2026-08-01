"use client";

import { openDB } from "idb";

import type { DueCard } from "@flashcards/api-client";
import {
  reviewEventSchema,
  syncMutationSchema,
  type ReviewEvent,
  type ReviewRating,
  type SyncMutation,
} from "@flashcards/domain";

export type QueuedReview = {
  mutationId: string;
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
  timezone: string;
};

export type SyncChange = {
  cursor: number;
  mutation: SyncMutation;
};

export type SyncPage = {
  cursor: number;
  changes: SyncChange[];
};

const syncCursorKey = "sync:server-cursor";

let databasePromise: ReturnType<typeof openDB> | undefined;

const database = () => {
  databasePromise ??= openDB("flora-offline-v1", 3, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        db.createObjectStore("due", { keyPath: "card.id" });
        db.createObjectStore("reviews", { keyPath: "mutationId" });
        db.createObjectStore("meta");
      }
      if (oldVersion < 2) {
        db.createObjectStore("reviewEvents", { keyPath: "mutationId" });
        db.createObjectStore("syncInbox", { keyPath: "cursor" });
      }
      if (oldVersion < 3) {
        transaction.objectStore("due").clear();
      }
    },
  });
  return databasePromise;
};

export const reviewEventFromSyncChange = (
  change: SyncChange,
): ReviewEvent | null => {
  const parsedMutation = syncMutationSchema.safeParse(change.mutation);
  if (!parsedMutation.success) return null;
  const mutation = parsedMutation.data;
  if (mutation.entityType !== "REVIEW" || mutation.operation !== "UPSERT") {
    return null;
  }
  const parsedEvent = reviewEventSchema.safeParse(mutation.payload);
  if (!parsedEvent.success) return null;
  const event = parsedEvent.data;
  return event.mutationId === mutation.mutationId &&
    event.id === mutation.entityId
    ? event
    : null;
};

export async function getSyncCursor(): Promise<number> {
  const cursor = await (await database()).get("meta", syncCursorKey);
  return typeof cursor === "number" &&
    Number.isSafeInteger(cursor) &&
    cursor >= 0
    ? cursor
    : 0;
}

export async function applySyncPage(page: SyncPage): Promise<void> {
  if (!Number.isSafeInteger(page.cursor) || page.cursor < 0) {
    throw new Error("Invalid server sync cursor");
  }
  const db = await database();
  const tx = db.transaction(
    ["due", "meta", "reviewEvents", "syncInbox"],
    "readwrite",
  );
  const abort = async (message: string): Promise<never> => {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new Error(message);
  };
  const metaStore = tx.objectStore("meta");
  const storedCursor = await metaStore.get(syncCursorKey);
  const currentCursor =
    typeof storedCursor === "number" &&
    Number.isSafeInteger(storedCursor) &&
    storedCursor >= 0
      ? storedCursor
      : 0;
  if (page.cursor < currentCursor) {
    return abort("Server sync cursor cannot move backwards");
  }

  let previousCursor = currentCursor;
  for (const change of page.changes) {
    if (
      !Number.isSafeInteger(change.cursor) ||
      change.cursor < 1 ||
      change.cursor > page.cursor
    ) {
      return abort("Invalid sync change cursor");
    }
    if (change.cursor <= currentCursor) continue;
    if (change.cursor <= previousCursor) {
      return abort("Sync changes are not strictly ordered");
    }
    previousCursor = change.cursor;
    await tx.objectStore("syncInbox").put(change);
    const event = reviewEventFromSyncChange(change);
    if (event) {
      await tx.objectStore("reviewEvents").put(event);
      await tx.objectStore("due").delete(event.cardId);
    }
  }
  await metaStore.put(page.cursor, syncCursorKey);
  await tx.done;
}

export async function synchronizeReviewProgress(
  pull: (cursor: number) => Promise<SyncPage>,
): Promise<number> {
  const page = await pull(await getSyncCursor());
  await applySyncPage(page);
  return page.cursor;
}

export async function storedReviewEvents(): Promise<ReviewEvent[]> {
  return (await database()).getAll("reviewEvents");
}

export async function closeOfflineDatabase(): Promise<void> {
  const pendingDatabase = databasePromise;
  if (!pendingDatabase) return;
  const db = await pendingDatabase;
  db.close();
  if (databasePromise === pendingDatabase) databasePromise = undefined;
}

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
  const tx = db.transaction(
    ["due", "reviews", "meta", "reviewEvents", "syncInbox"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("due").clear(),
    tx.objectStore("reviews").clear(),
    tx.objectStore("meta").clear(),
    tx.objectStore("reviewEvents").clear(),
    tx.objectStore("syncInbox").clear(),
  ]);
  await tx.done;
  await closeOfflineDatabase();
}
