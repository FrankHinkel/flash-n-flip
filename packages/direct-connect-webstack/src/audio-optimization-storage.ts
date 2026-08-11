import { Capacitor } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";

import {
  audioOptimizationJobSchema,
  type AudioOptimizationJob,
} from "@flashcards/domain/audio-optimization";

import { openWebLocalAuthorityDatabase } from "./local-authority-storage";
import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  nativeDatabaseName,
  nativeSqliteRows,
  withNativeDatabaseLock,
} from "./native-database";

export interface LocalAudioOptimizationStorage {
  list(): Promise<AudioOptimizationJob[]>;
  put(job: AudioOptimizationJob): Promise<void>;
  delete(mediaId: string): Promise<void>;
}

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

export class IndexedDbAudioOptimizationStorage
  implements LocalAudioOptimizationStorage
{
  private async withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("audioOptimizationJobs", mode);
      const result = await operation(
        transaction.objectStore("audioOptimizationJobs"),
      );
      await transactionDone(transaction);
      return result;
    } finally {
      database.close();
    }
  }

  list(): Promise<AudioOptimizationJob[]> {
    return this.withStore("readonly", async (store) =>
      audioOptimizationJobSchema
        .array()
        .parse(await requestResult(store.getAll()))
        .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt)),
    );
  }

  put(job: AudioOptimizationJob): Promise<void> {
    return this.withStore("readwrite", async (store) => {
      await requestResult(store.put(audioOptimizationJobSchema.parse(job)));
    });
  }

  delete(mediaId: string): Promise<void> {
    return this.withStore("readwrite", async (store) => {
      await requestResult(store.delete(mediaId));
    });
  }
}

type SqlitePlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "isDBOpen" | "open" | "execute" | "run" | "query"
>;

export class NativeSqliteAudioOptimizationStorage
  implements LocalAudioOptimizationStorage
{
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
            CREATE TABLE IF NOT EXISTS local_audio_optimization_jobs (
              media_id TEXT PRIMARY KEY NOT NULL,
              record_json TEXT NOT NULL
            );
          `,
        }),
      );
    })();
    return this.ready;
  }

  async list(): Promise<AudioOptimizationJob[]> {
    await this.initialize();
    const result = await withNativeDatabaseLock(this.database, () =>
      this.sqlite.query({
        database: this.database,
        statement:
          "SELECT record_json FROM local_audio_optimization_jobs ORDER BY media_id",
        values: [],
      }),
    );
    return nativeSqliteRows<{ record_json: string }>(result.values)
      .map((row) => audioOptimizationJobSchema.parse(JSON.parse(row.record_json)))
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  async put(job: AudioOptimizationJob): Promise<void> {
    await this.initialize();
    const parsed = audioOptimizationJobSchema.parse(job);
    await withNativeDatabaseLock(this.database, () =>
      this.sqlite.run({
        database: this.database,
        statement: `INSERT INTO local_audio_optimization_jobs (media_id, record_json)
          VALUES (?, ?)
          ON CONFLICT(media_id) DO UPDATE SET record_json = excluded.record_json`,
        values: [parsed.mediaId, JSON.stringify(parsed)],
        transaction: true,
      }),
    );
  }

  async delete(mediaId: string): Promise<void> {
    await this.initialize();
    await withNativeDatabaseLock(this.database, () =>
      this.sqlite.run({
        database: this.database,
        statement:
          "DELETE FROM local_audio_optimization_jobs WHERE media_id = ?",
        values: [mediaId],
        transaction: true,
      }),
    );
  }
}

export const createLocalAudioOptimizationStorage =
  (): LocalAudioOptimizationStorage =>
    Capacitor.isNativePlatform()
      ? new NativeSqliteAudioOptimizationStorage()
      : new IndexedDbAudioOptimizationStorage();
