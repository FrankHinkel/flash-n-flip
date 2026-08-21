"use client";

import { openDB } from "idb";

import type {
  DeckDetail,
  DeckSummary,
  DueCard,
  XefjordCrossLanguageCardRef,
  XefjordCrossLanguageDeck,
  XefjordCrossLanguagePair,
} from "@flashcards/api-client";
import {
  createId,
  deckDescendantIds,
  peerMutationSchema,
  reviewEventSchema,
  syncMutationSchema,
  type Device,
  type PeerMutation,
  type PeerTransferManifest,
  type ReplicaWatermarks,
  type ReviewEvent,
  type ReviewRating,
  type SyncMutation,
} from "@flashcards/domain";
import type { CardContent } from "@flashcards/domain/content";
import { IncrementalSha256 } from "@flashcards/peer-transfer";
import {
  applyRating,
  defaultParameters,
  emptyCardState,
  previewRatings,
  schedulerVersion,
} from "@flashcards/scheduler";

import {
  isXefjordLanguageDeck,
  xefjordCollectionTemplateKey,
  xefjordCollectionTitle,
} from "./xefjord-deck";

export type QueuedReview = {
  mutationId: string;
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
  timezone: string;
  virtualCard?: XefjordCrossLanguageCardRef;
  localOnly?: boolean;
  authorityCommitted?: boolean;
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
const xefjordCrossLanguageDecksKey = "xefjord-cross-language:decks";
const locallyTransferredDeckIdsKey = "local-transfer:deck-ids";
const xefjordCrossLanguagePairKey = (
  sourceDeckId: string,
  targetDeckId: string,
) => `xefjord-cross-language:pair:${sourceDeckId}:${targetDeckId}`;
const xefjordPhraseIndexKey = (deckId: string) =>
  `xefjord-cross-language:phrase-index:v1:${deckId}`;

export type CachedXefjordPhraseEntry = {
  noteId: string;
  pivot: string;
  english: string;
  phrase: CardContent;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CachedXefjordPhraseIndex = {
  schemaVersion: 1;
  deckId: string;
  locale: string;
  fingerprint: string;
  entries: Array<[string, CachedXefjordPhraseEntry]>;
};

export type CachedProfile = {
  id?: string;
  displayName: string;
  email: string;
  locale: "de" | "en";
  passwordChangeRequired: boolean;
};

type CachedMedia = {
  id: string;
  blob: Blob;
};

export type LocalDeviceIdentity = {
  id: string;
  displayName: string;
  platform: "WEB" | "APPLE" | "ANDROID" | "WINDOWS";
  publicKey: string;
  privateKey: CryptoKey;
  createdAt: string;
};

export type LocalTransferSession = {
  id: string;
  peerDeviceId: string;
  direction: "SEND" | "RECEIVE";
  state:
    | "PREPARING"
    | "AWAITING_ACCEPTANCE"
    | "CONNECTING"
    | "TRANSFERRING"
    | "VERIFYING"
    | "COMMITTING"
    | "COMPLETED"
    | "PAUSED"
    | "CANCELLED"
    | "FAILED";
  manifest: PeerTransferManifest | null;
  verifiedBytes: number;
  verifiedObjects: number;
  updatedAt: string;
  error: string | null;
};

type LocalTransferChunk = {
  transferId: string;
  mediaId: string;
  index: number;
  sha256: string;
  data: Blob;
};

type PeerReviewPayload = {
  event: ReviewEvent;
  virtualCard?: XefjordCrossLanguageCardRef;
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const parsePeerReviewPayload = (payload: unknown): PeerReviewPayload => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Peer review payload is invalid");
  }
  const candidate = payload as {
    event?: unknown;
    virtualCard?: Partial<XefjordCrossLanguageCardRef>;
  };
  const event = reviewEventSchema.parse(candidate.event);
  const virtual = candidate.virtualCard;
  if (!virtual) return { event };
  if (
    virtual.kind !== "XEFJORD_CROSS_LANGUAGE_V1" ||
    !isUuid(virtual.questionDeckId) ||
    !isUuid(virtual.answerDeckId) ||
    typeof virtual.matchKey !== "string" ||
    !/^[0-9a-f]{64}$/.test(virtual.matchKey)
  ) {
    throw new Error("Peer virtual-card metadata is invalid");
  }
  return { event, virtualCard: virtual as XefjordCrossLanguageCardRef };
};

let databasePromise: ReturnType<typeof openDB> | undefined;

const database = () => {
  databasePromise ??= openDB("flash-n-flip-offline-v2", 6, {
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
      if (oldVersion < 6) {
        db.createObjectStore("deviceIdentity", { keyPath: "id" });
        db.createObjectStore("peerDevices", { keyPath: "id" });
        db.createObjectStore("peerMutations", { keyPath: "mutationId" });
        db.createObjectStore("replicaWatermarks", { keyPath: "deviceId" });
        db.createObjectStore("transferSessions", { keyPath: "id" });
        db.createObjectStore("transferChunks", {
          keyPath: ["transferId", "mediaId", "index"],
        });
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
  const localIds = new Set(
    ((await tx.objectStore("meta").get(locallyTransferredDeckIdsKey)) as
      string[] | undefined) ?? [],
  );
  await Promise.all(
    decks
      .filter((deck) => !localIds.has(deck.id))
      .map((deck) => tx.objectStore("decks").put(deck)),
  );
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
  const localIds =
    ((await db.get("meta", locallyTransferredDeckIdsKey)) as
      string[] | undefined) ?? [];
  const selectedIds = [...new Set([...(ids ?? []), ...localIds])];
  if (!selectedIds.length) return [];
  const decks = await Promise.all(
    selectedIds.map(
      (id) => db.get("decks", id) as Promise<DeckSummary | undefined>,
    ),
  );
  return decks.filter(
    (deck): deck is DeckSummary =>
      Boolean(deck) &&
      (includeHidden || !deck?.hiddenAt) &&
      (includeArchived || !deck?.archivedAt),
  );
}

export async function repairTransferredXefjordCollection(): Promise<boolean> {
  const db = await database();
  const tx = db.transaction(["decks", "deckDetails", "meta"], "readwrite");
  const deckStore = tx.objectStore("decks");
  const detailStore = tx.objectStore("deckDetails");
  const metaStore = tx.objectStore("meta");
  const localIds = new Set(
    ((await metaStore.get(locallyTransferredDeckIdsKey)) as
      string[] | undefined) ?? [],
  );
  const summaries = (await deckStore.getAll()) as DeckSummary[];
  let collection = summaries.find(
    (deck) =>
      localIds.has(deck.id) &&
      deck.sourceTemplateKey === xefjordCollectionTemplateKey &&
      !deck.archivedAt,
  );
  const collectionIds = new Set(
    summaries
      .filter(
        (deck) =>
          deck.sourceTemplateKey === xefjordCollectionTemplateKey &&
          !deck.archivedAt,
      )
      .map((deck) => deck.id),
  );
  const orphaned = summaries.filter(
    (deck) =>
      localIds.has(deck.id) &&
      !deck.archivedAt &&
      isXefjordLanguageDeck(deck) &&
      (!deck.parentDeckId || !collectionIds.has(deck.parentDeckId)),
  );
  let changed = false;
  if (!collection) {
    const basis = orphaned[0]
      ? ((await detailStore.get(orphaned[0].id)) as DeckDetail | undefined)
      : undefined;
    if (!basis) {
      await tx.done;
      return false;
    }
    const collectionDetail: DeckDetail = {
      ...basis,
      id: createId(),
      parentDeckId: null,
      title: xefjordCollectionTitle,
      description: "",
      contentLocales: ["en"],
      defaultContentLocale: "en",
      sourceLocale: "en",
      targetLocale: "en",
      tags: ["Anki Import", "Collection"],
      favorite: false,
      learningEnabled: false,
      hiddenAt: null,
      archivedAt: null,
      visual: null,
      sourceTemplateKey: xefjordCollectionTemplateKey,
      cards: [],
    };
    const { cards: _cards, ...fields } = collectionDetail;
    collection = {
      ...fields,
      cardCount: 0,
      reviewedCardCount: 0,
      storageBytes: new TextEncoder().encode(JSON.stringify(collectionDetail))
        .byteLength,
    };
    await deckStore.put(collection);
    await detailStore.put(collectionDetail);
    localIds.add(collection.id);
    changed = true;
  }
  for (const deck of orphaned) {
    const detail = (await detailStore.get(deck.id)) as DeckDetail | undefined;
    await deckStore.put({ ...deck, parentDeckId: collection.id });
    if (detail) {
      await detailStore.put({ ...detail, parentDeckId: collection.id });
    }
    changed = true;
  }
  const allLocalIds = [...localIds];
  await metaStore.put(allLocalIds, locallyTransferredDeckIdsKey);
  for (const includeHidden of [false, true]) {
    for (const includeArchived of [false, true]) {
      const key = deckListKey(includeHidden, includeArchived);
      const ids = ((await metaStore.get(key)) as string[] | undefined) ?? [];
      await metaStore.put([...new Set([...ids, collection.id])], key);
    }
  }
  const refreshedSummaries = (await deckStore.getAll()) as DeckSummary[];
  const refreshedDetails = (await detailStore.getAll()) as DeckDetail[];
  const activeSummaries = refreshedSummaries.filter((deck) => !deck.archivedAt);
  const summaryById = new Map(activeSummaries.map((deck) => [deck.id, deck]));
  const detailById = new Map(refreshedDetails.map((deck) => [deck.id, deck]));
  for (const localCollection of activeSummaries.filter(
    (deck) =>
      localIds.has(deck.id) &&
      deck.sourceTemplateKey === xefjordCollectionTemplateKey,
  )) {
    const detail = detailById.get(localCollection.id);
    if (!detail) continue;
    const descendants = new Set(
      deckDescendantIds(activeSummaries, localCollection.id),
    );
    descendants.delete(localCollection.id);
    const cardCount = [...descendants].reduce(
      (sum, deckId) => sum + (detailById.get(deckId)?.cards.length ?? 0),
      0,
    );
    const reviewedCardCount = [...descendants].reduce(
      (sum, deckId) => sum + (summaryById.get(deckId)?.reviewedCardCount ?? 0),
      0,
    );
    const ownStorageBytes = new TextEncoder().encode(
      JSON.stringify(detail),
    ).byteLength;
    const storageBytes = activeSummaries
      .filter((deck) => deck.parentDeckId === localCollection.id)
      .reduce((sum, deck) => sum + deck.storageBytes, ownStorageBytes);
    if (
      localCollection.cardCount !== cardCount ||
      localCollection.reviewedCardCount !== reviewedCardCount ||
      localCollection.storageBytes !== storageBytes
    ) {
      await deckStore.put({
        ...localCollection,
        cardCount,
        reviewedCardCount,
        storageBytes,
      });
      changed = true;
    }
  }
  await tx.done;
  return changed;
}

export async function isLocallyTransferredDeck(
  deckId: string,
): Promise<boolean> {
  const ids = ((await (
    await database()
  ).get("meta", locallyTransferredDeckIdsKey)) ?? []) as string[];
  return ids.includes(deckId);
}

const transferredDeckMediaIds = (deck: DeckDetail): Set<string> => {
  const ids = new Set<string>();
  if (deck.visual?.kind === "IMAGE") ids.add(deck.visual.value);
  for (const card of deck.cards) {
    const contents = [
      card.front,
      card.back,
      ...Object.values(card.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ];
    for (const content of contents) {
      for (const block of content.blocks) {
        if (
          block.type === "image" ||
          block.type === "audio" ||
          block.type === "video"
        ) {
          ids.add(block.mediaId);
          if (block.type === "video" && block.posterMediaId) {
            ids.add(block.posterMediaId);
          }
        } else if (block.type === "imageOverlay") {
          ids.add(block.baseMediaId);
          ids.add(block.overlayMediaId);
        }
      }
    }
  }
  return ids;
};

export async function setLocallyTransferredDecksArchived(
  deckIds: ReadonlySet<string>,
  archivedAt: string | null,
): Promise<void> {
  const db = await database();
  const tx = db.transaction(["decks", "deckDetails", "meta"], "readwrite");
  const localIds = new Set(
    ((await tx.objectStore("meta").get(locallyTransferredDeckIdsKey)) as
      string[] | undefined) ?? [],
  );
  for (const deckId of deckIds) {
    if (!localIds.has(deckId)) continue;
    const summary = (await tx.objectStore("decks").get(deckId)) as
      DeckSummary | undefined;
    const detail = (await tx.objectStore("deckDetails").get(deckId)) as
      DeckDetail | undefined;
    if (summary) await tx.objectStore("decks").put({ ...summary, archivedAt });
    if (detail) {
      await tx.objectStore("deckDetails").put({ ...detail, archivedAt });
    }
  }
  await tx.done;
}

export async function permanentlyDeleteLocallyTransferredDecks(
  deckIds: ReadonlySet<string>,
): Promise<void> {
  const db = await database();
  const tx = db.transaction(
    [
      "decks",
      "deckDetails",
      "due",
      "continuedStudy",
      "media",
      "meta",
      "transferSessions",
    ],
    "readwrite",
  );
  const detailStore = tx.objectStore("deckDetails");
  const metaStore = tx.objectStore("meta");
  const localIds =
    ((await metaStore.get(locallyTransferredDeckIdsKey)) as
      string[] | undefined) ?? [];
  const deletedIds = new Set(localIds.filter((id) => deckIds.has(id)));
  const details = (await detailStore.getAll()) as DeckDetail[];
  const deletedDetails = details.filter((deck) => deletedIds.has(deck.id));
  const retainedMediaIds = new Set(
    details
      .filter((deck) => !deletedIds.has(deck.id))
      .flatMap((deck) => [...transferredDeckMediaIds(deck)]),
  );
  const deletedMediaIds = new Set(
    deletedDetails.flatMap((deck) => [...transferredDeckMediaIds(deck)]),
  );
  for (const deck of deletedDetails) {
    for (const card of deck.cards) {
      await tx.objectStore("due").delete(card.id);
      await tx.objectStore("continuedStudy").delete(card.id);
    }
    await tx.objectStore("decks").delete(deck.id);
    await detailStore.delete(deck.id);
    await tx.objectStore("meta").delete(`due-scope:${deck.id}`);
    await tx.objectStore("meta").delete(`due-order:${deck.id}`);
  }
  for (const mediaId of deletedMediaIds) {
    if (!retainedMediaIds.has(mediaId)) {
      await tx.objectStore("media").delete(mediaId);
    }
  }
  await metaStore.put(
    localIds.filter((id) => !deletedIds.has(id)),
    locallyTransferredDeckIdsKey,
  );
  for (const includeHidden of [false, true]) {
    for (const includeArchived of [false, true]) {
      const key = deckListKey(includeHidden, includeArchived);
      const ids = ((await metaStore.get(key)) as string[] | undefined) ?? [];
      await metaStore.put(
        ids.filter((id) => !deletedIds.has(id)),
        key,
      );
    }
  }
  const sessions = (await tx
    .objectStore("transferSessions")
    .getAll()) as LocalTransferSession[];
  for (const session of sessions) {
    if (session.manifest?.rootDeckIds.some((id) => deletedIds.has(id))) {
      await tx.objectStore("transferSessions").delete(session.id);
    }
  }
  await tx.done;
}

export async function cacheXefjordCrossLanguageDecks(
  languages: XefjordCrossLanguageDeck[],
): Promise<void> {
  await (await database()).put("meta", languages, xefjordCrossLanguageDecksKey);
}

export async function getCachedXefjordCrossLanguageDecks(): Promise<
  XefjordCrossLanguageDeck[]
> {
  return (
    ((await (await database()).get("meta", xefjordCrossLanguageDecksKey)) as
      XefjordCrossLanguageDeck[] | undefined) ?? []
  );
}

export async function cacheXefjordCrossLanguagePair(
  pair: XefjordCrossLanguagePair,
): Promise<void> {
  await (
    await database()
  ).put(
    "meta",
    pair,
    xefjordCrossLanguagePairKey(pair.source.id, pair.target.id),
  );
}

export async function getCachedXefjordCrossLanguagePair(
  sourceDeckId: string,
  targetDeckId: string,
): Promise<XefjordCrossLanguagePair | null> {
  return (
    ((await (
      await database()
    ).get("meta", xefjordCrossLanguagePairKey(sourceDeckId, targetDeckId))) as
      XefjordCrossLanguagePair | undefined) ?? null
  );
}

export async function cacheXefjordPhraseIndex(
  index: CachedXefjordPhraseIndex,
): Promise<void> {
  await (
    await database()
  ).put("meta", index, xefjordPhraseIndexKey(index.deckId));
}

export async function getCachedXefjordPhraseIndex(
  deckId: string,
): Promise<CachedXefjordPhraseIndex | null> {
  const cached = (await (
    await database()
  ).get("meta", xefjordPhraseIndexKey(deckId))) as
    CachedXefjordPhraseIndex | undefined;
  return cached?.schemaVersion === 1 ? cached : null;
}

export async function cacheDeckDetail(deck: DeckDetail): Promise<void> {
  await (await database()).put("deckDetails", deck);
}

export async function installTransferredDeck(
  deck: DeckDetail,
  storageBytes: number,
): Promise<void> {
  const { cards, ...summaryFields } = deck;
  const summary: DeckSummary = {
    ...summaryFields,
    cardCount: cards.length,
    reviewedCardCount: 0,
    storageBytes,
  };
  const db = await database();
  const tx = db.transaction(["decks", "deckDetails", "meta"], "readwrite");
  await tx.objectStore("decks").put(summary);
  await tx.objectStore("deckDetails").put(deck);
  const key = deckListKey(true, true);
  const currentIds =
    ((await tx.objectStore("meta").get(key)) as string[] | undefined) ?? [];
  if (!currentIds.includes(deck.id)) {
    await tx.objectStore("meta").put([...currentIds, deck.id], key);
  }
  await tx.done;
}

export async function commitTransferredDecks(input: {
  decks: DeckDetail[];
  media: ReadonlyMap<string, Blob>;
  sourceStorageBytes?: ReadonlyMap<string, number>;
  session: LocalTransferSession;
}): Promise<void> {
  const now = new Date();
  const encoder = new TextEncoder();
  const storageBytesByDeckId = new Map(
    input.decks.map((deck) => {
      const metadataBytes = encoder.encode(JSON.stringify(deck)).byteLength;
      const mediaBytes = [...transferredDeckMediaIds(deck)].reduce(
        (sum, mediaId) => sum + (input.media.get(mediaId)?.size ?? 0),
        0,
      );
      return [
        deck.id,
        input.sourceStorageBytes?.get(deck.id) ?? metadataBytes + mediaBytes,
      ] as const;
    }),
  );
  const db = await database();
  const tx = db.transaction(
    [
      "decks",
      "deckDetails",
      "media",
      "meta",
      "transferSessions",
      "due",
      "continuedStudy",
    ],
    "readwrite",
  );
  const deckStore = tx.objectStore("decks");
  const detailStore = tx.objectStore("deckDetails");
  const dueStore = tx.objectStore("due");
  const continuedStore = tx.objectStore("continuedStudy");
  for (const deck of input.decks) {
    const previous = (await detailStore.get(deck.id)) as DeckDetail | undefined;
    const previousCardIds = new Set(
      previous?.cards.map((card) => card.id) ?? [],
    );
    const nextCardIds = new Set(deck.cards.map((card) => card.id));
    for (const cardId of previousCardIds) {
      if (nextCardIds.has(cardId)) continue;
      await dueStore.delete(cardId);
      await continuedStore.delete(cardId);
    }
    for (const card of deck.cards) {
      if (previousCardIds.has(card.id) && (await dueStore.get(card.id)))
        continue;
      const state = emptyCardState(now);
      await dueStore.put({
        card,
        studyMode: "LEARNING",
        lastRating: null,
        state,
        preview: previewRatings(state, now),
      } satisfies DueCard);
    }
    const { cards, ...summaryFields } = deck;
    const previousSummary = (await deckStore.get(deck.id)) as
      DeckSummary | undefined;
    const summary: DeckSummary = {
      ...summaryFields,
      cardCount: cards.length,
      reviewedCardCount: previousSummary?.reviewedCardCount ?? 0,
      storageBytes: storageBytesByDeckId.get(deck.id) ?? 0,
    };
    await deckStore.put(summary);
    await detailStore.put(deck);
    await tx.objectStore("meta").put(
      cards.map((card) => card.id),
      `due-scope:${deck.id}`,
    );
    await tx.objectStore("meta").put(
      cards.map((card) => card.id),
      `due-order:${deck.id}`,
    );
  }
  for (const [id, blob] of input.media) {
    await tx.objectStore("media").put({ id, blob } satisfies CachedMedia);
  }
  const key = deckListKey(true, true);
  const currentIds =
    ((await tx.objectStore("meta").get(key)) as string[] | undefined) ?? [];
  const localIds =
    ((await tx.objectStore("meta").get(locallyTransferredDeckIdsKey)) as
      string[] | undefined) ?? [];
  const transferredIds = input.decks.map((deck) => deck.id);
  await tx
    .objectStore("meta")
    .put([...new Set([...currentIds, ...transferredIds])], key);
  await tx
    .objectStore("meta")
    .put(
      [...new Set([...localIds, ...transferredIds])],
      locallyTransferredDeckIdsKey,
    );
  await tx.objectStore("transferSessions").put(input.session);
  await tx.done;
}

export async function commitTransferredDeck(input: {
  deck: DeckDetail;
  media: ReadonlyMap<string, Blob>;
  session: LocalTransferSession;
}): Promise<void> {
  await commitTransferredDecks({
    decks: [input.deck],
    media: input.media,
    session: input.session,
  });
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

export async function getLocalDeviceIdentity(): Promise<LocalDeviceIdentity | null> {
  const records = (await (
    await database()
  ).getAll("deviceIdentity")) as LocalDeviceIdentity[];
  return records[0] ?? null;
}

export async function storeLocalDeviceIdentity(
  identity: LocalDeviceIdentity,
): Promise<void> {
  const db = await database();
  const tx = db.transaction("deviceIdentity", "readwrite");
  await tx.store.clear();
  await tx.store.put(identity);
  await tx.done;
}

export async function replacePeerDevices(devices: Device[]): Promise<void> {
  const db = await database();
  const tx = db.transaction("peerDevices", "readwrite");
  await tx.store.clear();
  await Promise.all(devices.map((device) => tx.store.put(device)));
  await tx.done;
}

export async function getPeerDevices(): Promise<Device[]> {
  return (await database()).getAll("peerDevices") as Promise<Device[]>;
}

export async function storeTransferSession(
  session: LocalTransferSession,
): Promise<void> {
  await (await database()).put("transferSessions", session);
}

export async function getTransferSession(
  transferId: string,
): Promise<LocalTransferSession | null> {
  return (
    ((await (await database()).get("transferSessions", transferId)) as
      LocalTransferSession | undefined) ?? null
  );
}

export async function getTransferSessions(): Promise<LocalTransferSession[]> {
  return (await database()).getAll("transferSessions") as Promise<
    LocalTransferSession[]
  >;
}

export async function storeTransferChunk(
  chunk: LocalTransferChunk,
): Promise<void> {
  await (await database()).put("transferChunks", chunk);
}

export async function getTransferChunkIndexes(
  transferId: string,
  mediaId: string,
): Promise<number[]> {
  const chunks = (await (
    await database()
  ).getAll("transferChunks")) as LocalTransferChunk[];
  return chunks
    .filter(
      (chunk) => chunk.transferId === transferId && chunk.mediaId === mediaId,
    )
    .map((chunk) => chunk.index)
    .sort((left, right) => left - right);
}

export async function getTransferChunks(
  transferId: string,
  mediaId: string,
): Promise<LocalTransferChunk[]> {
  const chunks = (await (
    await database()
  ).getAll("transferChunks")) as LocalTransferChunk[];
  return chunks
    .filter(
      (chunk) => chunk.transferId === transferId && chunk.mediaId === mediaId,
    )
    .sort((left, right) => left.index - right.index);
}

export async function deleteTransferStaging(transferId: string): Promise<void> {
  const db = await database();
  const tx = db.transaction(
    ["transferSessions", "transferChunks"],
    "readwrite",
  );
  await tx.objectStore("transferSessions").delete(transferId);
  let cursor = await tx.objectStore("transferChunks").openCursor();
  while (cursor) {
    if (cursor.value.transferId === transferId) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function clearTransferChunks(transferId: string): Promise<void> {
  const db = await database();
  const tx = db.transaction("transferChunks", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.transferId === transferId) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getReplicaWatermarks(): Promise<ReplicaWatermarks> {
  const rows = (await (await database()).getAll("replicaWatermarks")) as Array<{
    deviceId: string;
    sequence: number;
  }>;
  return Object.fromEntries(rows.map((row) => [row.deviceId, row.sequence]));
}

export async function getPeerMutations(): Promise<PeerMutation[]> {
  return (await database()).getAll("peerMutations") as Promise<PeerMutation[]>;
}

export async function applyPeerMutationBatch(
  mutations: PeerMutation[],
): Promise<ReplicaWatermarks> {
  const parsed = mutations.map((mutation) =>
    peerMutationSchema.parse(mutation),
  );
  const db = await database();
  const tx = db.transaction(
    ["peerMutations", "replicaWatermarks", "reviewEvents", "reviews", "due"],
    "readwrite",
  );
  const journal = tx.objectStore("peerMutations");
  const watermarks = tx.objectStore("replicaWatermarks");
  const ordered = [...parsed].sort(
    (left, right) =>
      left.originDeviceId.localeCompare(right.originDeviceId) ||
      left.originSequence - right.originSequence,
  );
  for (const mutation of ordered) {
    const computedPayloadHash = new IncrementalSha256()
      .update(new TextEncoder().encode(JSON.stringify(mutation.payload)))
      .digestHex();
    if (computedPayloadHash !== mutation.payloadHash) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new Error("Peer mutation payload hash does not match");
    }
    const existingMutation = (await journal.get(mutation.mutationId)) as
      PeerMutation | undefined;
    if (existingMutation) {
      if (existingMutation.payloadHash !== mutation.payloadHash) {
        tx.abort();
        await tx.done.catch(() => undefined);
        throw new Error("Peer mutation identity collision");
      }
      continue;
    }
    const stored = (await watermarks.get(mutation.originDeviceId)) as
      { deviceId: string; sequence: number } | undefined;
    const currentSequence = stored?.sequence ?? 0;
    if (mutation.originSequence !== currentSequence + 1) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new Error("Peer mutation sequence contains a gap");
    }
    await journal.put(mutation);
    if (mutation.entityType === "REVIEW" && mutation.operation === "UPSERT") {
      const { event, virtualCard } = parsePeerReviewPayload(mutation.payload);
      await tx.objectStore("reviewEvents").put(event);
      await tx.objectStore("reviews").put({
        mutationId: event.mutationId,
        cardId: event.cardId,
        rating: event.rating,
        reviewedAt: event.reviewedAt,
        timezone: event.timezone,
        ...(virtualCard ? { virtualCard } : {}),
      } satisfies QueuedReview);
      await tx.objectStore("due").delete(event.cardId);
    }
    await watermarks.put({
      deviceId: mutation.originDeviceId,
      sequence: mutation.originSequence,
    });
  }
  await tx.done;
  return getReplicaWatermarks();
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
  const tx = db.transaction(
    [
      "reviews",
      "due",
      "continuedStudy",
      "deviceIdentity",
      "meta",
      "peerMutations",
      "replicaWatermarks",
    ],
    "readwrite",
  );
  const dueBefore = (await tx.objectStore("due").get(review.cardId)) as
    DueCard | undefined;
  if (!review.localOnly) await tx.objectStore("reviews").put(review);
  await tx.objectStore("due").delete(review.cardId);
  const continuedStudy = tx.objectStore("continuedStudy");
  const cached = (await continuedStudy.get(review.cardId)) as
    DueCard | undefined;
  const source = cached ?? dueBefore;
  if (source) {
    const reviewedAt = new Date(review.reviewedAt);
    const state = applyRating(source.state, review.rating, reviewedAt);
    const updatedDue = {
      ...source,
      lastRating: review.rating,
      state,
      preview: previewRatings(state, reviewedAt),
    } satisfies DueCard;
    if (cached) await continuedStudy.put(updatedDue);
    if (review.localOnly) await tx.objectStore("due").put(updatedDue);
    const identity = (await tx.objectStore("deviceIdentity").openCursor())
      ?.value as LocalDeviceIdentity | undefined;
    const profile = (await tx.objectStore("meta").get(profileKey)) as
      CachedProfile | undefined;
    if (identity && profile?.id && !review.authorityCommitted) {
      const sequenceKey = `peer-sequence:${identity.id}`;
      const currentSequence =
        ((await tx.objectStore("meta").get(sequenceKey)) as
          number | undefined) ?? 0;
      const event = reviewEventSchema.parse({
        id: review.mutationId,
        mutationId: review.mutationId,
        userId: profile.id,
        cardId: review.cardId,
        reviewedAt: review.reviewedAt,
        timezone: review.timezone,
        rating: review.rating,
        schedulerVersion,
        parameters: [...defaultParameters.w],
        before: source.state,
        after: state,
      });
      const payload: PeerReviewPayload = {
        event,
        ...(review.virtualCard ? { virtualCard: review.virtualCard } : {}),
      };
      const payloadHash = new IncrementalSha256()
        .update(new TextEncoder().encode(JSON.stringify(payload)))
        .digestHex();
      const mutation = peerMutationSchema.parse({
        mutationId: review.mutationId,
        entityId: review.mutationId,
        entityType: "REVIEW",
        operation: "UPSERT",
        originDeviceId: identity.id,
        originSequence: currentSequence + 1,
        modifiedAt: review.reviewedAt,
        baseVersion: null,
        resultVersion: null,
        payloadHash,
        payload,
      });
      await tx.objectStore("peerMutations").put(mutation);
      await tx.objectStore("replicaWatermarks").put({
        deviceId: identity.id,
        sequence: currentSequence + 1,
      });
      await tx.objectStore("meta").put(currentSequence + 1, sequenceKey);
    }
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
  let failed = false;
  let firstFailure: unknown;
  for (const review of await queuedReviews()) {
    if (review.localOnly) {
      await acknowledgeReview(review.mutationId);
      continue;
    }
    try {
      await send(review);
      await acknowledgeReview(review.mutationId);
    } catch (cause) {
      if (!failed) firstFailure = cause;
      failed = true;
    }
  }
  if (failed) throw firstFailure;
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
      "deviceIdentity",
      "peerDevices",
      "peerMutations",
      "replicaWatermarks",
      "transferSessions",
      "transferChunks",
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
    tx.objectStore("deviceIdentity").clear(),
    tx.objectStore("peerDevices").clear(),
    tx.objectStore("peerMutations").clear(),
    tx.objectStore("replicaWatermarks").clear(),
    tx.objectStore("transferSessions").clear(),
    tx.objectStore("transferChunks").clear(),
  ]);
  await tx.done;
  await closeOfflineDatabase();
}
