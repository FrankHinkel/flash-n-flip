import { Capacitor } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";
import {
  buildStudyBadgePlanFromDueBuckets,
  type ReviewRating,
  type StudyBadgePlan,
} from "@flashcards/domain";

import type {
  LocalAuthorityMetadata,
  LocalMaterializedEntity,
} from "@flashcards/domain/local-authority";
import type {
  PeerMutation,
  ReplicaWatermarks,
} from "@flashcards/domain/device-sync";
import type {
  LocalAuthorityByteHasher,
  LocalAuthorityStorage,
  LocalAuthorityTransaction,
} from "@flashcards/sync/local-authority";

import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  legacyNativeDatabaseName,
  nativeDatabaseName,
  nativeSqliteRows,
  rollbackNativeTransactionIfActive,
  withNativeDatabaseLock,
} from "./native-database";

export const legacyWebLocalAuthorityDatabaseName =
  "flash-n-flip-local-authority";
export const webLocalAuthorityDatabaseName = "flash-n-flip-local-authority-v2";

export const webCryptoLocalAuthorityHasher: LocalAuthorityByteHasher = async (
  bytes,
) => {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export async function retireLegacyNativeLocalData(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const existing = await CapacitorSQLite.isDatabase({
    database: legacyNativeDatabaseName,
    readonly: false,
  });
  if (existing.result) {
    await CapacitorSQLite.deleteDatabase({
      database: legacyNativeDatabaseName,
      readonly: false,
    });
  }
}

type SqlitePlugin = Pick<
  CapacitorSQLitePlugin,
  | "createConnection"
  | "isDBOpen"
  | "open"
  | "execute"
  | "beginTransaction"
  | "commitTransaction"
  | "rollbackTransaction"
  | "run"
  | "query"
> &
  Partial<Pick<CapacitorSQLitePlugin, "isTransactionActive">>;

export type LocalStudyCardQuery = {
  deckIds: readonly string[];
  dueBefore: string;
  introducedAfter: string;
  includeFutureReviews?: boolean;
  excludedCardIds?: readonly string[];
  reviewLimit: number;
  newDeckIds: readonly string[];
  newLimit: number;
};

export type LocalStudyCardCounts = {
  dueReviews: number;
  availableNew: number;
  introducedToday: number;
  introducedNoteIds: string[];
};

export type LocalStudyBadgeQuery = {
  deckIds: readonly string[];
  now: Date;
  maximumTransitions?: number;
};

export type LocalLatestReviewRating = {
  cardId: string;
  rating: ReviewRating;
  reviewedAt: string;
};

const localStudyNoteId = (entity: LocalMaterializedEntity): string => {
  const mutation = entity.winningMutation;
  if (mutation.entityType !== "CARD" || mutation.operation !== "UPSERT") {
    return mutation.entityId;
  }
  const noteId = (mutation.payload as { noteId?: unknown }).noteId;
  return typeof noteId === "string" && noteId.trim()
    ? noteId
    : mutation.entityId;
};

const studyCardProjection = (entity: LocalMaterializedEntity) => {
  const mutation = entity.winningMutation;
  if (mutation.entityType !== "CARD" || mutation.operation !== "UPSERT") {
    return {};
  }
  const payload = mutation.payload as {
    deckId?: unknown;
    suspended?: unknown;
    state?: { due?: unknown; reps?: unknown };
  };
  if (
    typeof payload.deckId !== "string" ||
    typeof payload.state?.due !== "string" ||
    typeof payload.state.reps !== "number"
  ) {
    return {};
  }
  return {
    cardDeckId: payload.deckId,
    cardDue: payload.state.due,
    cardBucket: payload.state.reps === 0 ? "NEW" : "REVIEW",
    cardSuspended: payload.suspended === true ? 1 : 0,
    ...(typeof (payload as { introducedAt?: unknown }).introducedAt === "string"
      ? {
          cardIntroducedAt: (payload as { introducedAt: string }).introducedAt,
        }
      : {}),
  } as const;
};

const reviewProjection = (entity: LocalMaterializedEntity) => {
  const mutation = entity.winningMutation;
  if (mutation.entityType !== "REVIEW" || mutation.operation !== "UPSERT") {
    return {};
  }
  const payload = mutation.payload as {
    cardId?: unknown;
    rating?: unknown;
    reviewedAt?: unknown;
  };
  if (
    typeof payload.cardId !== "string" ||
    typeof payload.reviewedAt !== "string" ||
    !["AGAIN", "HARD", "GOOD", "EASY"].includes(String(payload.rating))
  ) {
    return {};
  }
  return {
    reviewCardId: payload.cardId,
    reviewRating: payload.rating as ReviewRating,
    reviewReviewedAt: payload.reviewedAt,
  } as const;
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });

export const openWebLocalAuthorityDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(webLocalAuthorityDatabaseName, 8);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains("metadata"))
        database.createObjectStore("metadata");
      const entities = database.objectStoreNames.contains("entities")
        ? request.transaction!.objectStore("entities")
        : database.createObjectStore("entities", { keyPath: "entityId" });
      if (!entities.indexNames.contains("entityType")) {
        entities.createIndex("entityType", "entityType", { unique: false });
      }
      if (!entities.indexNames.contains("cardStudy")) {
        entities.createIndex(
          "cardStudy",
          ["entityType", "cardSuspended", "cardBucket", "cardDue", "entityId"],
          { unique: false },
        );
      }
      if (!entities.indexNames.contains("cardDeckStudy")) {
        entities.createIndex(
          "cardDeckStudy",
          [
            "entityType",
            "cardDeckId",
            "cardSuspended",
            "cardBucket",
            "cardDue",
            "entityId",
          ],
          { unique: false },
        );
      }
      if (!entities.indexNames.contains("cardIntroduced")) {
        entities.createIndex(
          "cardIntroduced",
          ["entityType", "cardIntroducedAt", "entityId"],
          { unique: false },
        );
      }
      if (!entities.indexNames.contains("reviewCardTime")) {
        entities.createIndex(
          "reviewCardTime",
          ["entityType", "reviewCardId", "reviewReviewedAt", "entityId"],
          { unique: false },
        );
      }
      if (event.oldVersion < 8) {
        const cursorRequest = entities.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const stored = cursor.value as IndexedEntity;
          cursor.update({
            ...stored,
            entityType: stored.entity.winningMutation.entityType,
            ...studyCardProjection(stored.entity),
            ...reviewProjection(stored.entity),
          } satisfies IndexedEntity);
          cursor.continue();
        };
      }
      const mutations = database.objectStoreNames.contains("mutations")
        ? request.transaction!.objectStore("mutations")
        : database.createObjectStore("mutations", { keyPath: "mutationId" });
      if (!mutations.indexNames.contains("originSequence")) {
        mutations.createIndex(
          "originSequence",
          ["originDeviceId", "originSequence"],
          { unique: false },
        );
      }
      if (!database.objectStoreNames.contains("outbox"))
        database.createObjectStore("outbox", { keyPath: "mutationId" });
      if (!database.objectStoreNames.contains("watermarks"))
        database.createObjectStore("watermarks", {
          keyPath: "originDeviceId",
        });
      if (!database.objectStoreNames.contains("media"))
        database.createObjectStore("media", { keyPath: "mediaId" });
      if (!database.objectStoreNames.contains("mediaChunks"))
        database.createObjectStore("mediaChunks", {
          keyPath: ["mediaId", "index"],
        });
      if (!database.objectStoreNames.contains("audioOptimizationJobs"))
        database.createObjectStore("audioOptimizationJobs", {
          keyPath: "mediaId",
        });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

type IndexedEntity = {
  entityId: string;
  entityType: PeerMutation["entityType"];
  entity: LocalMaterializedEntity;
  cardDeckId?: string;
  cardDue?: string;
  cardBucket?: "NEW" | "REVIEW";
  cardSuspended?: 0 | 1;
  cardIntroducedAt?: string;
  reviewCardId?: string;
  reviewRating?: ReviewRating;
  reviewReviewedAt?: string;
};

const indexedEntitiesExcluding = (
  index: IDBIndex,
  range: IDBKeyRange,
  limit: number,
  excludedCardIds: ReadonlySet<string>,
): Promise<IndexedEntity[]> =>
  new Promise((resolve, reject) => {
    const result: IndexedEntity[] = [];
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || result.length >= limit) {
        resolve(result);
        return;
      }
      const entity = cursor.value as IndexedEntity;
      if (!excludedCardIds.has(entity.entityId)) result.push(entity);
      cursor.continue();
    };
  });

const reviewCardTimeRange = (cardId: string): IDBKeyRange =>
  IDBKeyRange.bound(
    ["REVIEW", cardId, "", ""],
    ["REVIEW", cardId, "\uffff", "\uffff"],
  );

const cardStudyRange = (
  bucket: "NEW" | "REVIEW",
  dueBefore?: string,
): IDBKeyRange =>
  IDBKeyRange.bound(
    ["CARD", 0, bucket, "", ""],
    ["CARD", 0, bucket, dueBefore ?? "\uffff", "\uffff"],
  );

const cardDeckStudyRange = (
  deckId: string,
  bucket: "NEW" | "REVIEW",
  dueBefore?: string,
): IDBKeyRange =>
  IDBKeyRange.bound(
    ["CARD", deckId, 0, bucket, "", ""],
    ["CARD", deckId, 0, bucket, dueBefore ?? "\uffff", "\uffff"],
  );

const cardDeckEntityRange = (
  deckId: string,
  suspended: 0 | 1,
  bucket: "NEW" | "REVIEW",
): IDBKeyRange =>
  IDBKeyRange.bound(
    ["CARD", deckId, suspended, bucket, "", ""],
    ["CARD", deckId, suspended, bucket, "\uffff", "\uffff"],
  );

const cardIntroducedRange = (
  introducedAfter: string,
  introducedBefore: string,
): IDBKeyRange =>
  IDBKeyRange.bound(
    ["CARD", introducedAfter, ""],
    ["CARD", introducedBefore, "\uffff"],
  );

const studyEntityOrder = (
  left: LocalMaterializedEntity,
  right: LocalMaterializedEntity,
): number => {
  const leftPayload = left.winningMutation.payload as {
    deckId?: string;
    state?: { due?: string };
  };
  const rightPayload = right.winningMutation.payload as {
    deckId?: string;
    state?: { due?: string };
  };
  return (
    (leftPayload.state?.due ?? "").localeCompare(
      rightPayload.state?.due ?? "",
    ) ||
    (leftPayload.deckId ?? "").localeCompare(rightPayload.deckId ?? "") ||
    left.winningMutation.entityId.localeCompare(right.winningMutation.entityId)
  );
};

const interleaveStudyEntityGroups = (
  groups: readonly (readonly LocalMaterializedEntity[])[],
  limit: number,
): LocalMaterializedEntity[] => {
  const sorted = groups
    .map((group) => [...group].sort(studyEntityOrder))
    .filter((group) => group.length)
    .sort((left, right) => studyEntityOrder(left[0]!, right[0]!));
  const result: LocalMaterializedEntity[] = [];
  for (let offset = 0; result.length < limit; offset += 1) {
    let appended = false;
    for (const group of sorted) {
      const entity = group[offset];
      if (!entity) continue;
      result.push(entity);
      appended = true;
      if (result.length >= limit) return result;
    }
    if (!appended) return result;
  }
  return result;
};

export class IndexedDbLocalAuthorityStorage implements LocalAuthorityStorage {
  async listCardEntities(deckId: string): Promise<LocalMaterializedEntity[]> {
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("entities", "readonly");
      const index = transaction.objectStore("entities").index("cardDeckStudy");
      const groups = await Promise.all(
        ([0, 1] as const).flatMap((suspended) =>
          (["NEW", "REVIEW"] as const).map((bucket) =>
            requestResult(
              index.getAll(cardDeckEntityRange(deckId, suspended, bucket)),
            ),
          ),
        ),
      );
      await transactionDone(transaction);
      return (groups as IndexedEntity[][]).flatMap((group) =>
        group.map((entry) => entry.entity),
      );
    } finally {
      database.close();
    }
  }

  async studyBadgePlan(input: LocalStudyBadgeQuery): Promise<StudyBadgePlan> {
    if (!input.deckIds.length) return { dueNow: 0, transitions: [] };
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("entities", "readonly");
      const index = transaction.objectStore("entities").index("cardDeckStudy");
      const groups = await Promise.all(
        input.deckIds.map((deckId) =>
          requestResult(index.getAll(cardDeckStudyRange(deckId, "REVIEW"))),
        ),
      );
      await transactionDone(transaction);
      return buildStudyBadgePlanFromDueBuckets(
        (groups as IndexedEntity[][]).flatMap((group) =>
          group.flatMap((entry) =>
            entry.cardDue ? [{ due: entry.cardDue, count: 1 }] : [],
          ),
        ),
        input.now,
        input.maximumTransitions,
      );
    } finally {
      database.close();
    }
  }

  async listLatestReviewRatings(
    cardIds: readonly string[],
  ): Promise<LocalLatestReviewRating[]> {
    if (!cardIds.length) return [];
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("entities", "readonly");
      const index = transaction.objectStore("entities").index("reviewCardTime");
      const entries = await Promise.all(
        [...new Set(cardIds)].map(async (cardId) => {
          const cursor = await requestResult(
            index.openCursor(reviewCardTimeRange(cardId), "prev"),
          );
          const stored = cursor?.value as IndexedEntity | undefined;
          return stored?.reviewRating && stored.reviewReviewedAt
            ? {
                cardId,
                rating: stored.reviewRating,
                reviewedAt: stored.reviewReviewedAt,
              }
            : null;
        }),
      );
      await transactionDone(transaction);
      return entries.filter(
        (entry): entry is LocalLatestReviewRating => entry !== null,
      );
    } finally {
      database.close();
    }
  }

  async listStudyCardEntities(
    input: LocalStudyCardQuery,
  ): Promise<LocalMaterializedEntity[]> {
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("entities", "readonly");
      const store = transaction.objectStore("entities");
      const globalIndex = store.index("cardStudy");
      const deckIndex = store.index("cardDeckStudy");
      const excludedCardIds = new Set(input.excludedCardIds ?? []);
      const readRange = (index: IDBIndex, range: IDBKeyRange, limit: number) =>
        excludedCardIds.size
          ? indexedEntitiesExcluding(index, range, limit, excludedCardIds)
          : requestResult(index.getAll(range, limit));
      const reviewPerDeckLimit = input.deckIds.length
        ? Math.min(
            input.reviewLimit,
            Math.max(
              4,
              Math.ceil(input.reviewLimit / input.deckIds.length) * 2,
            ),
          )
        : input.reviewLimit;
      const newPerDeckLimit = input.newDeckIds.length
        ? Math.min(
            input.newLimit,
            Math.max(
              2,
              Math.ceil(input.newLimit / input.newDeckIds.length) * 2,
            ),
          )
        : input.newLimit;
      const reviewRequests = input.deckIds.length
        ? input.deckIds.map((deckId) =>
            readRange(
              deckIndex,
              cardDeckStudyRange(
                deckId,
                "REVIEW",
                input.includeFutureReviews ? undefined : input.dueBefore,
              ),
              reviewPerDeckLimit,
            ),
          )
        : [
            readRange(
              globalIndex,
              cardStudyRange(
                "REVIEW",
                input.includeFutureReviews ? undefined : input.dueBefore,
              ),
              reviewPerDeckLimit,
            ),
          ];
      const newRequests = input.newDeckIds.map((deckId) =>
        readRange(
          deckIndex,
          cardDeckStudyRange(deckId, "NEW"),
          newPerDeckLimit,
        ),
      );
      const [reviewGroups, newGroups] = await Promise.all([
        Promise.all(reviewRequests),
        Promise.all(newRequests),
      ]);
      await transactionDone(transaction);
      return [
        ...interleaveStudyEntityGroups(
          (reviewGroups as IndexedEntity[][]).map((group) =>
            group.map((entry) => entry.entity),
          ),
          input.reviewLimit,
        ),
        ...interleaveStudyEntityGroups(
          (newGroups as IndexedEntity[][]).map((group) =>
            group.map((entry) => entry.entity),
          ),
          input.newLimit,
        ),
      ];
    } finally {
      database.close();
    }
  }

  async countStudyCards(
    input: Omit<LocalStudyCardQuery, "reviewLimit" | "includeFutureReviews">,
  ): Promise<LocalStudyCardCounts> {
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("entities", "readonly");
      const store = transaction.objectStore("entities");
      const globalIndex = store.index("cardStudy");
      const deckIndex = store.index("cardDeckStudy");
      const introducedIndex = store.index("cardIntroduced");
      const reviewRequests = input.deckIds.length
        ? input.deckIds.map((deckId) =>
            requestResult(
              deckIndex.count(
                cardDeckStudyRange(deckId, "REVIEW", input.dueBefore),
              ),
            ),
          )
        : [
            requestResult(
              globalIndex.count(cardStudyRange("REVIEW", input.dueBefore)),
            ),
          ];
      const newRequests = input.newDeckIds.map((deckId) =>
        requestResult(deckIndex.count(cardDeckStudyRange(deckId, "NEW"))),
      );
      const [reviewCounts, newCounts, introducedEntries] = await Promise.all([
        Promise.all(reviewRequests),
        Promise.all(newRequests),
        requestResult(
          introducedIndex.getAll(
            cardIntroducedRange(input.introducedAfter, input.dueBefore),
          ),
        ),
      ]);
      await transactionDone(transaction);
      const introduced = (introducedEntries as IndexedEntity[]).filter(
        (entry) =>
          input.deckIds.length === 0 ||
          (entry.cardDeckId !== undefined &&
            input.deckIds.includes(entry.cardDeckId)),
      );
      return {
        dueReviews: reviewCounts.reduce((sum, count) => sum + count, 0),
        availableNew: Math.min(
          input.newLimit,
          newCounts.reduce((sum, count) => sum + count, 0),
        ),
        introducedToday: introduced.length,
        introducedNoteIds: [
          ...new Set(introduced.map((entry) => localStudyNoteId(entry.entity))),
        ],
      };
    } finally {
      database.close();
    }
  }

  async transaction<T>(
    mode: "readonly" | "readwrite",
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await openWebLocalAuthorityDatabase();
    let nativeTransaction: IDBTransaction;
    try {
      nativeTransaction = database.transaction(
        ["metadata", "entities", "mutations", "outbox", "watermarks"],
        mode,
      );
    } catch (cause) {
      database.close();
      throw cause;
    }
    const metadata = nativeTransaction.objectStore("metadata");
    const entities = nativeTransaction.objectStore("entities");
    const mutations = nativeTransaction.objectStore("mutations");
    const outbox = nativeTransaction.objectStore("outbox");
    const watermarks = nativeTransaction.objectStore("watermarks");
    const transaction: LocalAuthorityTransaction = {
      getMetadata: async () =>
        ((await requestResult(metadata.get("authority"))) as
          LocalAuthorityMetadata | undefined) ?? null,
      putMetadata: async (value) => {
        await requestResult(metadata.put(value, "authority"));
      },
      getEntity: async (entityId) => {
        const stored = (await requestResult(entities.get(entityId))) as
          IndexedEntity | undefined;
        return stored?.entity ?? null;
      },
      putEntity: async (entity) => {
        await requestResult(
          entities.put({
            entityId: entity.winningMutation.entityId,
            entityType: entity.winningMutation.entityType,
            entity,
            ...studyCardProjection(entity),
            ...reviewProjection(entity),
          } satisfies IndexedEntity),
        );
      },
      deleteEntity: async (entityId) => {
        await requestResult(entities.delete(entityId));
      },
      listEntities: async (options = {}) => {
        const request = options.entityType
          ? entities.index("entityType").getAll(options.entityType)
          : entities.getAll();
        return ((await requestResult(request)) as IndexedEntity[]).map(
          (entry) => entry.entity,
        );
      },
      getMutation: async (mutationId) =>
        ((await requestResult(mutations.get(mutationId))) as
          PeerMutation | undefined) ?? null,
      putMutation: async (mutation) => {
        await requestResult(mutations.put(mutation));
      },
      deleteMutation: async (mutationId) => {
        await requestResult(mutations.delete(mutationId));
      },
      listMutations: async () =>
        (await requestResult(mutations.getAll())) as PeerMutation[],
      getMaximumOriginSequence: async (originDeviceId) => {
        const request = mutations
          .index("originSequence")
          .openKeyCursor(
            IDBKeyRange.bound(
              [originDeviceId, 0],
              [originDeviceId, Number.MAX_SAFE_INTEGER],
            ),
            "prev",
          );
        const cursor = await requestResult(request);
        const key = cursor?.key;
        return Array.isArray(key) && typeof key[1] === "number" ? key[1] : 0;
      },
      putOutboxMutationId: async (mutationId) => {
        await requestResult(outbox.put({ mutationId }));
      },
      deleteOutboxMutationId: async (mutationId) => {
        await requestResult(outbox.delete(mutationId));
      },
      listOutboxMutationIds: async () =>
        ((await requestResult(outbox.getAllKeys())) as IDBValidKey[]).map(
          String,
        ),
      countOutboxMutationIds: async () =>
        Number(await requestResult(outbox.count())),
      getWatermark: async (originDeviceId) => {
        const stored = (await requestResult(watermarks.get(originDeviceId))) as
          { sequence?: unknown } | undefined;
        return typeof stored?.sequence === "number" ? stored.sequence : 0;
      },
      putWatermark: async (originDeviceId, sequence) => {
        await requestResult(watermarks.put({ originDeviceId, sequence }));
      },
      listWatermarks: async () =>
        Object.fromEntries(
          (
            (await requestResult(watermarks.getAll())) as Array<{
              originDeviceId: string;
              sequence: number;
            }>
          ).map((entry) => [entry.originDeviceId, entry.sequence]),
        ) as ReplicaWatermarks,
    };

    try {
      const result = await operation(transaction);
      await transactionDone(nativeTransaction);
      return result;
    } catch (cause) {
      try {
        nativeTransaction.abort();
      } catch {
        // The transaction may already have aborted because a request failed.
      }
      await transactionDone(nativeTransaction).catch(() => undefined);
      throw cause;
    } finally {
      database.close();
    }
  }
}

export class NativeSqliteLocalAuthorityStorage implements LocalAuthorityStorage {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly sqlite: SqlitePlugin = CapacitorSQLite,
    private readonly database = nativeDatabaseName,
  ) {}

  private initialize(): Promise<void> {
    this.ready ??= (async () => {
      await ensureNativeDatabaseConnection(this.sqlite, this.database);
      await withNativeDatabaseLock(this.database, () =>
        this.sqlite.execute({
          database: this.database,
          transaction: true,
          statements: `
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS local_authority_metadata (
            singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
            device_id TEXT NOT NULL,
            next_origin_sequence INTEGER NOT NULL CHECK (next_origin_sequence > 0)
          );
          CREATE TABLE IF NOT EXISTS local_authority_entities (
            entity_id TEXT PRIMARY KEY NOT NULL,
            record_json TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS local_authority_entities_type_idx
            ON local_authority_entities(
              json_extract(record_json, '$.winningMutation.entityType')
            );
          CREATE INDEX IF NOT EXISTS local_authority_entities_study_idx
            ON local_authority_entities(
              json_extract(record_json, '$.winningMutation.entityType'),
              json_extract(record_json, '$.winningMutation.payload.suspended'),
              CASE
                WHEN json_extract(record_json, '$.winningMutation.payload.state.reps') = 0
                THEN 'NEW'
                ELSE 'REVIEW'
              END,
              json_extract(record_json, '$.winningMutation.payload.state.due')
            );
          CREATE INDEX IF NOT EXISTS local_authority_entities_deck_study_idx
            ON local_authority_entities(
              json_extract(record_json, '$.winningMutation.entityType'),
              json_extract(record_json, '$.winningMutation.payload.deckId'),
              json_extract(record_json, '$.winningMutation.payload.suspended'),
              CASE
                WHEN json_extract(record_json, '$.winningMutation.payload.state.reps') = 0
                THEN 'NEW'
                ELSE 'REVIEW'
              END,
              json_extract(record_json, '$.winningMutation.payload.state.due')
            );
          CREATE INDEX IF NOT EXISTS local_authority_entities_introduced_idx
            ON local_authority_entities(
              json_extract(record_json, '$.winningMutation.entityType'),
              json_extract(record_json, '$.winningMutation.payload.introducedAt')
            );
          CREATE INDEX IF NOT EXISTS local_authority_entities_review_card_idx
            ON local_authority_entities(
              json_extract(record_json, '$.winningMutation.entityType'),
              json_extract(record_json, '$.winningMutation.payload.cardId'),
              json_extract(record_json, '$.winningMutation.payload.reviewedAt')
            );
          CREATE TABLE IF NOT EXISTS local_authority_mutations (
            mutation_id TEXT PRIMARY KEY NOT NULL,
            origin_device_id TEXT NOT NULL,
            origin_sequence INTEGER NOT NULL CHECK (origin_sequence > 0),
            record_json TEXT NOT NULL,
            UNIQUE (origin_device_id, origin_sequence)
          );
          CREATE TABLE IF NOT EXISTS local_authority_outbox (
            mutation_id TEXT PRIMARY KEY NOT NULL,
            FOREIGN KEY (mutation_id) REFERENCES local_authority_mutations(mutation_id)
          );
          CREATE TABLE IF NOT EXISTS local_authority_watermarks (
            origin_device_id TEXT PRIMARY KEY NOT NULL,
            sequence INTEGER NOT NULL CHECK (sequence >= 0)
          );
        `,
        }),
      );
    })();
    return this.ready;
  }

  async transaction<T>(
    _mode: "readonly" | "readwrite",
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    await this.initialize();
    return withNativeDatabaseLock(this.database, () =>
      this.runTransaction(operation),
    );
  }

  private async runTransaction<T>(
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    await this.sqlite.beginTransaction({ database: this.database });
    const queryOne = async <T>(
      statement: string,
      values: unknown[],
    ): Promise<T | null> => {
      const result = await this.sqlite.query({
        database: this.database,
        statement,
        values,
      });
      return nativeSqliteRows<T>(result.values)[0] ?? null;
    };
    const queryAll = async <T>(
      statement: string,
      values: unknown[] = [],
    ): Promise<T[]> => {
      const result = await this.sqlite.query({
        database: this.database,
        statement,
        values,
      });
      return nativeSqliteRows<T>(result.values);
    };
    const run = async (statement: string, values: unknown[]): Promise<void> => {
      await this.sqlite.run({
        database: this.database,
        statement,
        values,
        transaction: false,
      });
    };
    const transaction: LocalAuthorityTransaction = {
      getMetadata: async () => {
        const row = await queryOne<{
          device_id: string;
          next_origin_sequence: number;
        }>(
          "SELECT device_id, next_origin_sequence FROM local_authority_metadata WHERE singleton_id = 1",
          [],
        );
        return row
          ? {
              deviceId: row.device_id,
              nextOriginSequence: row.next_origin_sequence,
            }
          : null;
      },
      putMetadata: async (metadata) =>
        run(
          `INSERT INTO local_authority_metadata
            (singleton_id, device_id, next_origin_sequence)
           VALUES (1, ?, ?)
           ON CONFLICT(singleton_id) DO UPDATE SET
             device_id = excluded.device_id,
             next_origin_sequence = excluded.next_origin_sequence`,
          [metadata.deviceId, metadata.nextOriginSequence],
        ),
      getEntity: async (entityId) => {
        const row = await queryOne<{ record_json: string }>(
          "SELECT record_json FROM local_authority_entities WHERE entity_id = ?",
          [entityId],
        );
        return row
          ? (JSON.parse(row.record_json) as LocalMaterializedEntity)
          : null;
      },
      putEntity: async (entity) =>
        run(
          `INSERT INTO local_authority_entities (entity_id, record_json)
           VALUES (?, ?)
           ON CONFLICT(entity_id) DO UPDATE SET record_json = excluded.record_json`,
          [entity.winningMutation.entityId, JSON.stringify(entity)],
        ),
      deleteEntity: async (entityId) =>
        run("DELETE FROM local_authority_entities WHERE entity_id = ?", [
          entityId,
        ]),
      listEntities: async (options = {}) => {
        const rows = options.entityType
          ? await queryAll<{ record_json: string }>(
              `SELECT record_json FROM local_authority_entities
                WHERE json_extract(record_json, '$.winningMutation.entityType') = ?
                ORDER BY entity_id`,
              [options.entityType],
            )
          : await queryAll<{ record_json: string }>(
              "SELECT record_json FROM local_authority_entities ORDER BY entity_id",
            );
        return rows.map(
          (row) => JSON.parse(row.record_json) as LocalMaterializedEntity,
        );
      },
      getMutation: async (mutationId) => {
        const row = await queryOne<{ record_json: string }>(
          "SELECT record_json FROM local_authority_mutations WHERE mutation_id = ?",
          [mutationId],
        );
        return row ? (JSON.parse(row.record_json) as PeerMutation) : null;
      },
      putMutation: async (mutation) =>
        run(
          `INSERT INTO local_authority_mutations
            (mutation_id, origin_device_id, origin_sequence, record_json)
           VALUES (?, ?, ?, ?)`,
          [
            mutation.mutationId,
            mutation.originDeviceId,
            mutation.originSequence,
            JSON.stringify(mutation),
          ],
        ),
      deleteMutation: async (mutationId) =>
        run("DELETE FROM local_authority_mutations WHERE mutation_id = ?", [
          mutationId,
        ]),
      listMutations: async () =>
        (
          await queryAll<{ record_json: string }>(
            `SELECT record_json FROM local_authority_mutations
             ORDER BY origin_device_id, origin_sequence`,
          )
        ).map((row) => JSON.parse(row.record_json) as PeerMutation),
      getMaximumOriginSequence: async (originDeviceId) => {
        const row = await queryOne<{ maximum_origin_sequence: number | null }>(
          `SELECT MAX(origin_sequence) AS maximum_origin_sequence
             FROM local_authority_mutations
            WHERE origin_device_id = ?`,
          [originDeviceId],
        );
        return row?.maximum_origin_sequence ?? 0;
      },
      putOutboxMutationId: async (mutationId) =>
        run(
          "INSERT OR IGNORE INTO local_authority_outbox (mutation_id) VALUES (?)",
          [mutationId],
        ),
      deleteOutboxMutationId: async (mutationId) =>
        run("DELETE FROM local_authority_outbox WHERE mutation_id = ?", [
          mutationId,
        ]),
      listOutboxMutationIds: async () =>
        (
          await queryAll<{ mutation_id: string }>(
            "SELECT mutation_id FROM local_authority_outbox ORDER BY mutation_id",
          )
        ).map((row) => row.mutation_id),
      countOutboxMutationIds: async () => {
        const row = await queryOne<{ outbox_count: number }>(
          "SELECT COUNT(*) AS outbox_count FROM local_authority_outbox",
          [],
        );
        return Number(row?.outbox_count ?? 0);
      },
      getWatermark: async (originDeviceId) => {
        const row = await queryOne<{ sequence: number }>(
          "SELECT sequence FROM local_authority_watermarks WHERE origin_device_id = ?",
          [originDeviceId],
        );
        return row?.sequence ?? 0;
      },
      putWatermark: async (originDeviceId, sequence) =>
        run(
          `INSERT INTO local_authority_watermarks (origin_device_id, sequence)
           VALUES (?, ?)
           ON CONFLICT(origin_device_id) DO UPDATE SET sequence = excluded.sequence`,
          [originDeviceId, sequence],
        ),
      listWatermarks: async () =>
        Object.fromEntries(
          (
            await queryAll<{ origin_device_id: string; sequence: number }>(
              "SELECT origin_device_id, sequence FROM local_authority_watermarks",
            )
          ).map((row) => [row.origin_device_id, row.sequence]),
        ) as ReplicaWatermarks,
    };

    try {
      const result = await operation(transaction);
      await this.sqlite.commitTransaction({ database: this.database });
      return result;
    } catch (cause) {
      await rollbackNativeTransactionIfActive(this.sqlite, this.database);
      throw cause;
    }
  }

  async listCardEntities(deckId: string): Promise<LocalMaterializedEntity[]> {
    await this.initialize();
    return withNativeDatabaseLock(this.database, async () => {
      const result = await this.sqlite.query({
        database: this.database,
        statement: `SELECT record_json
          FROM local_authority_entities
          WHERE json_extract(record_json, '$.winningMutation.entityType') = 'CARD'
            AND json_extract(record_json, '$.winningMutation.operation') = 'UPSERT'
            AND json_extract(record_json, '$.winningMutation.payload.deckId') = ?`,
        values: [deckId],
      });
      return nativeSqliteRows<{ record_json: string }>(result.values).map(
        (row) => JSON.parse(row.record_json) as LocalMaterializedEntity,
      );
    });
  }

  async studyBadgePlan(input: LocalStudyBadgeQuery): Promise<StudyBadgePlan> {
    if (!input.deckIds.length) return { dueNow: 0, transitions: [] };
    await this.initialize();
    return withNativeDatabaseLock(this.database, async () => {
      const result = await this.sqlite.query({
        database: this.database,
        statement: `SELECT
            json_extract(record_json, '$.winningMutation.payload.state.due') AS due,
            COUNT(*) AS card_count
          FROM local_authority_entities
          WHERE json_extract(record_json, '$.winningMutation.entityType') = 'CARD'
            AND json_extract(record_json, '$.winningMutation.operation') = 'UPSERT'
            AND COALESCE(json_extract(record_json, '$.winningMutation.payload.suspended'), 0) = 0
            AND json_extract(record_json, '$.winningMutation.payload.state.reps') > 0
            AND json_extract(record_json, '$.winningMutation.payload.deckId')
              IN (SELECT value FROM json_each(?))
          GROUP BY due
          ORDER BY due`,
        values: [JSON.stringify([...new Set(input.deckIds)])],
      });
      return buildStudyBadgePlanFromDueBuckets(
        nativeSqliteRows<{ due: string; card_count: number }>(
          result.values,
        ).map((row) => ({ due: row.due, count: Number(row.card_count) })),
        input.now,
        input.maximumTransitions,
      );
    });
  }

  async listStudyCardEntities(
    input: LocalStudyCardQuery,
  ): Promise<LocalMaterializedEntity[]> {
    await this.initialize();
    return withNativeDatabaseLock(this.database, async () => {
      const read = async (
        deckId: string | null,
        bucket: "NEW" | "REVIEW",
        limit: number,
      ): Promise<LocalMaterializedEntity[]> => {
        if (limit <= 0) return [];
        const conditions = [
          "json_extract(record_json, '$.winningMutation.entityType') = 'CARD'",
          "json_extract(record_json, '$.winningMutation.operation') = 'UPSERT'",
          "COALESCE(json_extract(record_json, '$.winningMutation.payload.suspended'), 0) = 0",
          bucket === "NEW"
            ? "json_extract(record_json, '$.winningMutation.payload.state.reps') = 0"
            : "json_extract(record_json, '$.winningMutation.payload.state.reps') > 0",
        ];
        const values: unknown[] = [];
        if (deckId) {
          conditions.push(
            "json_extract(record_json, '$.winningMutation.payload.deckId') = ?",
          );
          values.push(deckId);
        }
        if (input.excludedCardIds?.length) {
          conditions.push("entity_id NOT IN (SELECT value FROM json_each(?))");
          values.push(JSON.stringify(input.excludedCardIds));
        }
        if (bucket === "REVIEW" && !input.includeFutureReviews) {
          conditions.push(
            "json_extract(record_json, '$.winningMutation.payload.state.due') <= ?",
          );
          values.push(input.dueBefore);
        }
        values.push(limit);
        const result = await this.sqlite.query({
          database: this.database,
          statement: `SELECT record_json
            FROM local_authority_entities
            WHERE ${conditions.join(" AND ")}
            ORDER BY json_extract(record_json, '$.winningMutation.payload.state.due'), entity_id
            LIMIT ?`,
          values,
        });
        return nativeSqliteRows<{ record_json: string }>(result.values).map(
          (row) => JSON.parse(row.record_json) as LocalMaterializedEntity,
        );
      };
      const reviewGroups = input.deckIds.length
        ? await Promise.all(
            input.deckIds.map((deckId) =>
              read(
                deckId,
                "REVIEW",
                Math.min(
                  input.reviewLimit,
                  Math.max(
                    4,
                    Math.ceil(input.reviewLimit / input.deckIds.length) * 2,
                  ),
                ),
              ),
            ),
          )
        : [await read(null, "REVIEW", input.reviewLimit)];
      const newGroups = await Promise.all(
        input.newDeckIds.map((deckId) =>
          read(
            deckId,
            "NEW",
            Math.min(
              input.newLimit,
              Math.max(
                2,
                Math.ceil(input.newLimit / input.newDeckIds.length) * 2,
              ),
            ),
          ),
        ),
      );
      return [
        ...interleaveStudyEntityGroups(reviewGroups, input.reviewLimit),
        ...interleaveStudyEntityGroups(newGroups, input.newLimit),
      ];
    });
  }

  async listLatestReviewRatings(
    cardIds: readonly string[],
  ): Promise<LocalLatestReviewRating[]> {
    if (!cardIds.length) return [];
    await this.initialize();
    return withNativeDatabaseLock(this.database, async () => {
      const uniqueCardIds = [...new Set(cardIds)];
      const placeholders = uniqueCardIds.map(() => "?").join(", ");
      const result = await this.sqlite.query({
        database: this.database,
        statement: `SELECT record_json
          FROM (
            SELECT record_json,
              ROW_NUMBER() OVER (
                PARTITION BY json_extract(record_json, '$.winningMutation.payload.cardId')
                ORDER BY json_extract(record_json, '$.winningMutation.payload.reviewedAt') DESC,
                  entity_id DESC
              ) AS review_rank
            FROM local_authority_entities
            WHERE json_extract(record_json, '$.winningMutation.entityType') = 'REVIEW'
              AND json_extract(record_json, '$.winningMutation.operation') = 'UPSERT'
              AND json_extract(record_json, '$.winningMutation.payload.cardId') IN (${placeholders})
          )
          WHERE review_rank = 1`,
        values: uniqueCardIds,
      });
      return nativeSqliteRows<{ record_json: string }>(result.values).map(
        (row) => {
          const entity = JSON.parse(row.record_json) as LocalMaterializedEntity;
          const payload = entity.winningMutation.payload as {
            cardId: string;
            rating: ReviewRating;
            reviewedAt: string;
          };
          return {
            cardId: payload.cardId,
            rating: payload.rating,
            reviewedAt: payload.reviewedAt,
          };
        },
      );
    });
  }

  async countStudyCards(
    input: Omit<LocalStudyCardQuery, "reviewLimit" | "includeFutureReviews">,
  ): Promise<LocalStudyCardCounts> {
    await this.initialize();
    return withNativeDatabaseLock(this.database, async () => {
      const count = async (
        deckId: string | null,
        bucket: "NEW" | "REVIEW",
      ): Promise<number> => {
        const conditions = [
          "json_extract(record_json, '$.winningMutation.entityType') = 'CARD'",
          "json_extract(record_json, '$.winningMutation.operation') = 'UPSERT'",
          "COALESCE(json_extract(record_json, '$.winningMutation.payload.suspended'), 0) = 0",
          bucket === "NEW"
            ? "json_extract(record_json, '$.winningMutation.payload.state.reps') = 0"
            : "json_extract(record_json, '$.winningMutation.payload.state.reps') > 0",
        ];
        const values: unknown[] = [];
        if (deckId) {
          conditions.push(
            "json_extract(record_json, '$.winningMutation.payload.deckId') = ?",
          );
          values.push(deckId);
        }
        if (bucket === "REVIEW") {
          conditions.push(
            "json_extract(record_json, '$.winningMutation.payload.state.due') <= ?",
          );
          values.push(input.dueBefore);
        }
        const result = await this.sqlite.query({
          database: this.database,
          statement: `SELECT COUNT(*) AS count
            FROM local_authority_entities
            WHERE ${conditions.join(" AND ")}`,
          values,
        });
        const row = nativeSqliteRows<{ count: number }>(result.values)[0];
        return Number(row?.count ?? 0);
      };
      const dueReviews = (
        await Promise.all(
          input.deckIds.length
            ? input.deckIds.map((deckId) => count(deckId, "REVIEW"))
            : [count(null, "REVIEW")],
        )
      ).reduce((sum, value) => sum + value, 0);
      const availableNew = Math.min(
        input.newLimit,
        (
          await Promise.all(
            input.newDeckIds.map((deckId) => count(deckId, "NEW")),
          )
        ).reduce((sum, value) => sum + value, 0),
      );
      const introducedConditions = [
        "json_extract(record_json, '$.winningMutation.entityType') = 'CARD'",
        "json_extract(record_json, '$.winningMutation.operation') = 'UPSERT'",
        "json_extract(record_json, '$.winningMutation.payload.introducedAt') >= ?",
        "json_extract(record_json, '$.winningMutation.payload.introducedAt') <= ?",
      ];
      const introducedValues: unknown[] = [
        input.introducedAfter,
        input.dueBefore,
      ];
      if (input.deckIds.length) {
        introducedConditions.push(
          "json_extract(record_json, '$.winningMutation.payload.deckId') IN (SELECT value FROM json_each(?))",
        );
        introducedValues.push(JSON.stringify([...new Set(input.deckIds)]));
      }
      const introducedResult = await this.sqlite.query({
        database: this.database,
        statement: `SELECT record_json
          FROM local_authority_entities
          WHERE ${introducedConditions.join(" AND ")}`,
        values: introducedValues,
      });
      const introducedCards = nativeSqliteRows<{ record_json: string }>(
        introducedResult.values,
      ).map((row) => JSON.parse(row.record_json) as LocalMaterializedEntity);
      return {
        dueReviews,
        availableNew,
        introducedToday: introducedCards.length,
        introducedNoteIds: [
          ...new Set(introducedCards.map((card) => localStudyNoteId(card))),
        ],
      };
    });
  }
}

export const createLocalAuthorityStorage = ():
  NativeSqliteLocalAuthorityStorage | IndexedDbLocalAuthorityStorage =>
  Capacitor.isNativePlatform()
    ? new NativeSqliteLocalAuthorityStorage()
    : new IndexedDbLocalAuthorityStorage();
