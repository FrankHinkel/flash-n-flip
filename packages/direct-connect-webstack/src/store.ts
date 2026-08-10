import { Capacitor } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";

import { phaseOneSnapshotSchema } from "@flashcards/domain/rendezvous";
import type { PhaseOneSnapshot } from "@flashcards/domain/rendezvous";
import type { PhaseOneSnapshotStore } from "@flashcards/sync/rendezvous";

import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  nativeDatabaseName as databaseName,
  withNativeDatabaseLock,
} from "./native-database";

const webDatabaseName = "flash-n-flip-phase-one";

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
>;

export class NativeSqlitePhaseOneStore implements PhaseOneSnapshotStore {
  private ready: Promise<void> | null = null;

  constructor(private readonly sqlite: SqlitePlugin = CapacitorSQLite) {}

  private initialize(): Promise<void> {
    this.ready ??= (async () => {
      await ensureNativeDatabaseConnection(this.sqlite, databaseName);
      await withNativeDatabaseLock(databaseName, () =>
        this.sqlite.execute({
          database: databaseName,
          transaction: true,
          statements: `
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS phase_one_decks (
            id TEXT PRIMARY KEY NOT NULL,
            snapshot_json TEXT NOT NULL,
            modified_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS phase_one_reviews (
            mutation_id TEXT PRIMARY KEY NOT NULL,
            deck_id TEXT NOT NULL,
            snapshot_json TEXT NOT NULL,
            reviewed_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS phase_one_receipts (
            transfer_id TEXT PRIMARY KEY NOT NULL,
            deck_id TEXT NOT NULL,
            review_mutation_id TEXT NOT NULL,
            received_at TEXT NOT NULL
          );
        `,
        }),
      );
    })();
    return this.ready;
  }

  async saveSnapshot(
    candidate: PhaseOneSnapshot,
  ): Promise<"INSERTED" | "DUPLICATE"> {
    const snapshot = phaseOneSnapshotSchema.parse(candidate);
    await this.initialize();
    return withNativeDatabaseLock(databaseName, async () => {
      await this.sqlite.beginTransaction({ database: databaseName });
      try {
        const existing = await this.sqlite.query({
          database: databaseName,
          statement:
            "SELECT transfer_id FROM phase_one_receipts WHERE transfer_id = ? LIMIT 1",
          values: [snapshot.transferId],
        });
        if ((existing.values?.length ?? 0) > 0) {
          await this.sqlite.commitTransaction({ database: databaseName });
          return "DUPLICATE";
        }
        await this.sqlite.run({
          database: databaseName,
          statement: `
          INSERT INTO phase_one_decks (id, snapshot_json, modified_at)
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            snapshot_json = excluded.snapshot_json,
            modified_at = excluded.modified_at
          WHERE excluded.modified_at >= phase_one_decks.modified_at
        `,
          values: [
            snapshot.deck.id,
            JSON.stringify(snapshot),
            snapshot.deck.modifiedAt,
          ],
          transaction: false,
        });
        await this.sqlite.run({
          database: databaseName,
          statement: `
          INSERT OR IGNORE INTO phase_one_reviews
            (mutation_id, deck_id, snapshot_json, reviewed_at)
          VALUES (?, ?, ?, ?)
        `,
          values: [
            snapshot.review.mutationId,
            snapshot.deck.id,
            JSON.stringify(snapshot),
            snapshot.review.reviewedAt,
          ],
          transaction: false,
        });
        await this.sqlite.run({
          database: databaseName,
          statement: `
          INSERT INTO phase_one_receipts
            (transfer_id, deck_id, review_mutation_id, received_at)
          VALUES (?, ?, ?, ?)
        `,
          values: [
            snapshot.transferId,
            snapshot.deck.id,
            snapshot.review.mutationId,
            new Date().toISOString(),
          ],
          transaction: false,
        });
        await this.sqlite.commitTransaction({ database: databaseName });
        return "INSERTED";
      } catch (cause) {
        await this.sqlite.rollbackTransaction({ database: databaseName });
        throw cause;
      }
    });
  }

  async loadSnapshot(): Promise<PhaseOneSnapshot | null> {
    await this.initialize();
    return withNativeDatabaseLock(databaseName, async () => {
      const result = await this.sqlite.query({
        database: databaseName,
        statement: `
        SELECT deck.snapshot_json
        FROM phase_one_receipts receipt
        JOIN phase_one_decks deck ON deck.id = receipt.deck_id
        ORDER BY receipt.received_at DESC
        LIMIT 1
      `,
        values: [],
      });
      const value = result.values?.[0] as
        { snapshot_json?: unknown } | undefined;
      if (typeof value?.snapshot_json !== "string") return null;
      return phaseOneSnapshotSchema.parse(JSON.parse(value.snapshot_json));
    });
  }
}

const openWebDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(webDatabaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("snapshots", { keyPath: "transferId" });
      database.createObjectStore("metadata");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

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

export class IndexedDbPhaseOneStore implements PhaseOneSnapshotStore {
  async saveSnapshot(
    candidate: PhaseOneSnapshot,
  ): Promise<"INSERTED" | "DUPLICATE"> {
    const snapshot = phaseOneSnapshotSchema.parse(candidate);
    const database = await openWebDatabase();
    try {
      const transaction = database.transaction(
        ["snapshots", "metadata"],
        "readwrite",
      );
      const snapshots = transaction.objectStore("snapshots");
      const duplicate = await requestResult(snapshots.get(snapshot.transferId));
      if (duplicate) {
        transaction.abort();
        return "DUPLICATE";
      }
      snapshots.add(snapshot);
      transaction.objectStore("metadata").put(snapshot.transferId, "latest");
      await transactionDone(transaction);
      return "INSERTED";
    } finally {
      database.close();
    }
  }

  async loadSnapshot(): Promise<PhaseOneSnapshot | null> {
    const database = await openWebDatabase();
    try {
      const transaction = database.transaction(
        ["snapshots", "metadata"],
        "readonly",
      );
      const transferId = await requestResult(
        transaction.objectStore("metadata").get("latest"),
      );
      if (typeof transferId !== "string") return null;
      const snapshot = await requestResult(
        transaction.objectStore("snapshots").get(transferId),
      );
      return snapshot ? phaseOneSnapshotSchema.parse(snapshot) : null;
    } finally {
      database.close();
    }
  }
}

export const createPhaseOneStore = (): PhaseOneSnapshotStore =>
  Capacitor.isNativePlatform()
    ? new NativeSqlitePhaseOneStore()
    : new IndexedDbPhaseOneStore();
