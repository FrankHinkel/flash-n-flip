import { Capacitor } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";

import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  nativeDatabaseName,
  nativeSqliteRows,
  withNativeDatabaseLock,
} from "./native-database";
import { openWebLocalAuthorityDatabase } from "./local-authority-storage";

export type StoredLocalMedia = {
  mediaId: string;
  mimeType: string;
  sha256: string;
  bytes: Uint8Array;
};

export type StoredLocalMediaChunk = {
  mediaId: string;
  index: number;
  chunkCount: number;
  sha256: string;
  mimeType: string;
  byteSize: number;
  bytes: Uint8Array;
};

export interface LocalMediaStorage {
  put(media: StoredLocalMedia): Promise<void>;
  get(mediaId: string): Promise<StoredLocalMedia | null>;
  list(): Promise<StoredLocalMedia[]>;
  listIds(): Promise<string[]>;
  delete(mediaId: string): Promise<void>;
  putChunk(chunk: StoredLocalMediaChunk): Promise<void>;
  listChunks(mediaId: string): Promise<StoredLocalMediaChunk[]>;
  deleteChunks(mediaId: string): Promise<void>;
  isEmpty(): Promise<boolean>;
}

type IndexedMedia = Omit<StoredLocalMedia, "bytes"> & { bytes: ArrayBuffer };
type IndexedMediaChunk = Omit<StoredLocalMediaChunk, "bytes"> & {
  bytes: ArrayBuffer;
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

const fromIndexed = (media: IndexedMedia): StoredLocalMedia => ({
  ...media,
  bytes: new Uint8Array(media.bytes),
});

export class IndexedDbLocalMediaStorage implements LocalMediaStorage {
  private async withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("media", mode);
      const result = await operation(transaction.objectStore("media"));
      await transactionDone(transaction);
      return result;
    } finally {
      database.close();
    }
  }

  put(media: StoredLocalMedia): Promise<void> {
    return this.withStore("readwrite", async (store) => {
      const bytes = media.bytes.slice().buffer;
      await requestResult(
        store.put({ ...media, bytes } satisfies IndexedMedia),
      );
    });
  }

  get(mediaId: string): Promise<StoredLocalMedia | null> {
    return this.withStore("readonly", async (store) => {
      const media = (await requestResult(store.get(mediaId))) as
        IndexedMedia | undefined;
      return media ? fromIndexed(media) : null;
    });
  }

  list(): Promise<StoredLocalMedia[]> {
    return this.withStore("readonly", async (store) =>
      ((await requestResult(store.getAll())) as IndexedMedia[])
        .map(fromIndexed)
        .sort((left, right) => left.mediaId.localeCompare(right.mediaId)),
    );
  }

  listIds(): Promise<string[]> {
    return this.withStore("readonly", async (store) =>
      ((await requestResult(store.getAllKeys())) as IDBValidKey[])
        .map(String)
        .sort(),
    );
  }

  delete(mediaId: string): Promise<void> {
    return this.withStore("readwrite", async (store) => {
      await requestResult(store.delete(mediaId));
    });
  }

  putChunk(chunk: StoredLocalMediaChunk): Promise<void> {
    return this.withChunkStore("readwrite", async (store) => {
      await requestResult(
        store.put({
          ...chunk,
          bytes: chunk.bytes.slice().buffer,
        } satisfies IndexedMediaChunk),
      );
    });
  }

  listChunks(mediaId: string): Promise<StoredLocalMediaChunk[]> {
    return this.withChunkStore("readonly", async (store) => {
      const range = IDBKeyRange.bound(
        [mediaId, 0],
        [mediaId, Number.MAX_SAFE_INTEGER],
      );
      return ((await requestResult(store.getAll(range))) as IndexedMediaChunk[])
        .map((chunk) => ({ ...chunk, bytes: new Uint8Array(chunk.bytes) }))
        .sort((left, right) => left.index - right.index);
    });
  }

  deleteChunks(mediaId: string): Promise<void> {
    return this.withChunkStore("readwrite", async (store) => {
      const range = IDBKeyRange.bound(
        [mediaId, 0],
        [mediaId, Number.MAX_SAFE_INTEGER],
      );
      await requestResult(store.delete(range));
    });
  }

  private async withChunkStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const database = await openWebLocalAuthorityDatabase();
    try {
      const transaction = database.transaction("mediaChunks", mode);
      const result = await operation(transaction.objectStore("mediaChunks"));
      await transactionDone(transaction);
      return result;
    } finally {
      database.close();
    }
  }

  async isEmpty(): Promise<boolean> {
    return (await this.list()).length === 0;
  }
}

type SqlitePlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "isDBOpen" | "open" | "execute" | "run" | "query"
>;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export class NativeSqliteLocalMediaStorage implements LocalMediaStorage {
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
          CREATE TABLE IF NOT EXISTS local_media (
            media_id TEXT PRIMARY KEY NOT NULL,
            mime_type TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            data_base64 TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS local_media_chunks (
            media_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_count INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            data_base64 TEXT NOT NULL,
            PRIMARY KEY (media_id, chunk_index)
          );
        `,
        }),
      );
    })();
    return this.ready;
  }

  async put(media: StoredLocalMedia): Promise<void> {
    await this.initialize();
    await withNativeDatabaseLock(this.database, () =>
      this.sqlite.run({
        database: this.database,
        statement: `INSERT INTO local_media (media_id, mime_type, sha256, data_base64)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(media_id) DO UPDATE SET
          mime_type = excluded.mime_type,
          sha256 = excluded.sha256,
          data_base64 = excluded.data_base64`,
        values: [
          media.mediaId,
          media.mimeType,
          media.sha256,
          bytesToBase64(media.bytes),
        ],
        transaction: true,
      }),
    );
  }

  async get(mediaId: string): Promise<StoredLocalMedia | null> {
    await this.initialize();
    const result = await withNativeDatabaseLock(this.database, () =>
      this.sqlite.query({
        database: this.database,
        statement:
          "SELECT media_id, mime_type, sha256, data_base64 FROM local_media WHERE media_id = ?",
        values: [mediaId],
      }),
    );
    const row = nativeSqliteRows<{
      media_id: string;
      mime_type: string;
      sha256: string;
      data_base64: string;
    }>(result.values)[0];
    return row
      ? {
          mediaId: row.media_id,
          mimeType: row.mime_type,
          sha256: row.sha256,
          bytes: base64ToBytes(row.data_base64),
        }
      : null;
  }

  async list(): Promise<StoredLocalMedia[]> {
    await this.initialize();
    const result = await withNativeDatabaseLock(this.database, () =>
      this.sqlite.query({
        database: this.database,
        statement:
          "SELECT media_id, mime_type, sha256, data_base64 FROM local_media ORDER BY media_id",
        values: [],
      }),
    );
    return nativeSqliteRows<{
      media_id: string;
      mime_type: string;
      sha256: string;
      data_base64: string;
    }>(result.values).map((row) => {
      return {
        mediaId: row.media_id,
        mimeType: row.mime_type,
        sha256: row.sha256,
        bytes: base64ToBytes(row.data_base64),
      };
    });
  }

  async listIds(): Promise<string[]> {
    await this.initialize();
    const result = await withNativeDatabaseLock(this.database, () =>
      this.sqlite.query({
        database: this.database,
        statement: "SELECT media_id FROM local_media ORDER BY media_id",
        values: [],
      }),
    );
    return nativeSqliteRows<{ media_id: string }>(result.values).map(
      (row) => row.media_id,
    );
  }

  async delete(mediaId: string): Promise<void> {
    await this.initialize();
    await withNativeDatabaseLock(this.database, () =>
      this.sqlite.run({
        database: this.database,
        statement: "DELETE FROM local_media WHERE media_id = ?",
        values: [mediaId],
        transaction: true,
      }),
    );
  }

  async putChunk(chunk: StoredLocalMediaChunk): Promise<void> {
    await this.initialize();
    await withNativeDatabaseLock(this.database, () =>
      this.sqlite.run({
        database: this.database,
        statement: `INSERT INTO local_media_chunks
        (media_id, chunk_index, chunk_count, sha256, mime_type, byte_size, data_base64)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(media_id, chunk_index) DO UPDATE SET
          chunk_count = excluded.chunk_count,
          sha256 = excluded.sha256,
          mime_type = excluded.mime_type,
          byte_size = excluded.byte_size,
          data_base64 = excluded.data_base64`,
        values: [
          chunk.mediaId,
          chunk.index,
          chunk.chunkCount,
          chunk.sha256,
          chunk.mimeType,
          chunk.byteSize,
          bytesToBase64(chunk.bytes),
        ],
        transaction: true,
      }),
    );
  }

  async listChunks(mediaId: string): Promise<StoredLocalMediaChunk[]> {
    await this.initialize();
    const result = await withNativeDatabaseLock(this.database, () =>
      this.sqlite.query({
        database: this.database,
        statement: `SELECT media_id, chunk_index, chunk_count, sha256,
        mime_type, byte_size, data_base64
        FROM local_media_chunks WHERE media_id = ? ORDER BY chunk_index`,
        values: [mediaId],
      }),
    );
    return nativeSqliteRows<{
      media_id: string;
      chunk_index: number;
      chunk_count: number;
      sha256: string;
      mime_type: string;
      byte_size: number;
      data_base64: string;
    }>(result.values).map((row) => {
      return {
        mediaId: row.media_id,
        index: row.chunk_index,
        chunkCount: row.chunk_count,
        sha256: row.sha256,
        mimeType: row.mime_type,
        byteSize: row.byte_size,
        bytes: base64ToBytes(row.data_base64),
      };
    });
  }

  async deleteChunks(mediaId: string): Promise<void> {
    await this.initialize();
    await withNativeDatabaseLock(this.database, () =>
      this.sqlite.run({
        database: this.database,
        statement: "DELETE FROM local_media_chunks WHERE media_id = ?",
        values: [mediaId],
        transaction: true,
      }),
    );
  }

  async isEmpty(): Promise<boolean> {
    return (await this.list()).length === 0;
  }
}

export const createLocalMediaStorage = (): LocalMediaStorage =>
  Capacitor.isNativePlatform()
    ? new NativeSqliteLocalMediaStorage()
    : new IndexedDbLocalMediaStorage();
