"use client";

import { openDB } from "idb";

import type { DeckDetail, DeckSummary, DueCard } from "@flashcards/api-client";
import {
  reviewEventSchema,
  syncMutationSchema,
  type ReviewEvent,
  type ReviewRating,
  type SyncMutation,
} from "@flashcards/domain";
import { applyRating, previewRatings } from "@flashcards/scheduler";

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
const profileKey = "account:profile";

export type CachedProfile = {
  displayName: string;
  email: string;
  locale: "de" | "en";
  passwordChangeRequired: boolean;
};

type CachedMedia = {
  id: string;
  blob: Blob;
};

let databasePromise: ReturnType<typeof openDB> | undefined;

const database = () => {
  databasePromise ??= openDB("flora-offline-v1", 5, {
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
      if (oldVersion < 4) {
        db.createObjectStore("decks", { keyPath: "id" });
        db.createObjectStore("deckDetails", { keyPath: "id" });
        db.createObjectStore("media", { keyPath: "id" });
      }
      if (oldVersion < 5) {
        db.createObjectStore("continuedStudy", { keyPath: "card.id" });
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
    let cursor = await metaStore.openCursor();
    while (cursor) {
      if (
        typeof cursor.key === "string" &&
        (cursor.key.startsWith("due-scope:") ||
          cursor.key.startsWith("due-order:"))
      ) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
  }
  await metaStore.put(
    cards.map((card) => card.card.id),
    `due-order:${deckId ?? "all"}`,
  );
  await Promise.all(cards.map((card) => dueStore.put(card)));
  await tx.done;
}

const deckListKey = (includeHidden: boolean, includeArchived: boolean) =>
  `deck-list:${includeHidden ? "hidden" : "visible"}:${
    includeArchived ? "archived" : "active"
  }`;

export async function cacheDecks(
  decks: DeckSummary[],
  includeHidden = false,
  includeArchived = false,
): Promise<void> {
  const db = await database();
  const tx = db.transaction(["decks", "meta"], "readwrite");
  await Promise.all(decks.map((deck) => tx.objectStore("decks").put(deck)));
  await tx.objectStore("meta").put(
    decks.map((deck) => deck.id),
    deckListKey(includeHidden, includeArchived),
  );
  await tx.done;
}

export async function getCachedDecks(
  includeHidden = false,
  includeArchived = false,
): Promise<DeckSummary[]> {
  const db = await database();
  const ids = (await db.get(
    "meta",
    deckListKey(includeHidden, includeArchived),
  )) as string[] | undefined;
  if (!ids) return [];
  const decks = await Promise.all(
    ids.map((id) => db.get("decks", id) as Promise<DeckSummary | undefined>),
  );
  return decks.filter((deck): deck is DeckSummary => Boolean(deck));
}

export async function cacheDeckDetail(deck: DeckDetail): Promise<void> {
  await (await database()).put("deckDetails", deck);
}

export async function getCachedDeckDetail(
  deckId: string,
): Promise<DeckDetail | null> {
  return (
    ((await (await database()).get("deckDetails", deckId)) as
      DeckDetail | undefined) ?? null
  );
}

export async function cacheProfile(profile: CachedProfile): Promise<void> {
  await (await database()).put("meta", profile, profileKey);
}

export async function getCachedProfile(): Promise<CachedProfile | null> {
  return (
    ((await (await database()).get("meta", profileKey)) as
      CachedProfile | undefined) ?? null
  );
}

export async function cacheMedia(mediaId: string, blob: Blob): Promise<void> {
  await (
    await database()
  ).put("media", { id: mediaId, blob } satisfies CachedMedia);
}

export async function getCachedMedia(mediaId: string): Promise<Blob | null> {
  const cached = (await (await database()).get("media", mediaId)) as
    CachedMedia | undefined;
  return cached?.blob ?? null;
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

export async function cacheContinuedStudyCards(
  cards: DueCard[],
  deckId?: string,
): Promise<void> {
  const db = await database();
  const tx = db.transaction(["continuedStudy", "meta"], "readwrite");
  const store = tx.objectStore("continuedStudy");
  if (!deckId) await store.clear();
  await Promise.all(cards.map((card) => store.put(card)));
  await tx.objectStore("meta").put(
    cards.map((card) => card.card.id),
    `continued-study:${deckId ?? "all"}`,
  );
  await tx.done;
}

export async function getCachedContinuedStudyCards(
  deckId?: string,
): Promise<DueCard[]> {
  const db = await database();
  const ids = (await db.get("meta", `continued-study:${deckId ?? "all"}`)) as
    string[] | undefined;
  if (!ids) return [];
  const cards = await Promise.all(
    ids.map(
      (id) => db.get("continuedStudy", id) as Promise<DueCard | undefined>,
    ),
  );
  return cards.filter((card): card is DueCard => Boolean(card));
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
  const tx = db.transaction(["reviews", "due", "continuedStudy"], "readwrite");
  await tx.objectStore("reviews").put(review);
  await tx.objectStore("due").delete(review.cardId);
  const continuedStudy = tx.objectStore("continuedStudy");
  const cached = (await continuedStudy.get(review.cardId)) as
    DueCard | undefined;
  if (cached) {
    const reviewedAt = new Date(review.reviewedAt);
    const state = applyRating(cached.state, review.rating, reviewedAt);
    await continuedStudy.put({
      ...cached,
      lastRating: review.rating,
      state,
      preview: previewRatings(state, reviewedAt),
    });
  }
  await tx.done;
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
  const tx = db.transaction(["due", "continuedStudy", "meta"], "readwrite");
  const removedCardIds = new Set<string>();
  let cursor = await tx.objectStore("due").openCursor();
  while (cursor) {
    if (selected.has(cursor.value.card.deckId)) {
      removedCardIds.add(cursor.value.card.id);
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  let continuedCursor = await tx.objectStore("continuedStudy").openCursor();
  while (continuedCursor) {
    if (selected.has(continuedCursor.value.card.deckId)) {
      removedCardIds.add(continuedCursor.value.card.id);
      await continuedCursor.delete();
    }
    continuedCursor = await continuedCursor.continue();
  }
  let metaCursor = await tx.objectStore("meta").openCursor();
  while (metaCursor) {
    if (
      typeof metaCursor.key === "string" &&
      (metaCursor.key.startsWith("due-scope:") ||
        metaCursor.key.startsWith("due-order:") ||
        metaCursor.key.startsWith("continued-study:")) &&
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
    [
      "due",
      "reviews",
      "meta",
      "reviewEvents",
      "syncInbox",
      "decks",
      "deckDetails",
      "media",
      "continuedStudy",
    ],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("due").clear(),
    tx.objectStore("reviews").clear(),
    tx.objectStore("meta").clear(),
    tx.objectStore("reviewEvents").clear(),
    tx.objectStore("syncInbox").clear(),
    tx.objectStore("decks").clear(),
    tx.objectStore("deckDetails").clear(),
    tx.objectStore("media").clear(),
    tx.objectStore("continuedStudy").clear(),
  ]);
  await tx.done;
  await closeOfflineDatabase();
}
