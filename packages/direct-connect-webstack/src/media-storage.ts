import { Capacitor } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";

import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  nativeDatabaseName,
} from "./native-database";
import { openWebLocalAuthorityDatabase } from "./local-authority-storage";

export type StoredLocalMedia = {
  mediaId: string;
  mimeType: string;
  sha256: string;
  bytes: Uint8Array;
};

export interface LocalMediaStorage {
  put(media: StoredLocalMedia): Promise<void>;
  get(mediaId: string): Promise<StoredLocalMedia | null>;
  list(): Promise<StoredLocalMedia[]>;
  delete(mediaId: string): Promise<void>;
  isEmpty(): Promise<boolean>;
}

type IndexedMedia = Omit<StoredLocalMedia, "bytes"> & { bytes: ArrayBuffer };

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

  delete(mediaId: string): Promise<void> {
    return this.withStore("readwrite", async (store) => {
      await requestResult(store.delete(mediaId));
    });
  }

  async isEmpty(): Promise<boolean> {
    return (await this.list()).length === 0;
  }
}

type SqlitePlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "open" | "execute" | "run" | "query"
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
      await this.sqlite.execute({
        database: this.database,
        transaction: true,
        statements: `
          CREATE TABLE IF NOT EXISTS local_media (
            media_id TEXT PRIMARY KEY NOT NULL,
            mime_type TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            data_base64 TEXT NOT NULL
          );
        `,
      });
    })();
    return this.ready;
  }

  async put(media: StoredLocalMedia): Promise<void> {
    await this.initialize();
    await this.sqlite.run({
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
    });
  }

  async get(mediaId: string): Promise<StoredLocalMedia | null> {
    await this.initialize();
    const result = await this.sqlite.query({
      database: this.database,
      statement:
        "SELECT media_id, mime_type, sha256, data_base64 FROM local_media WHERE media_id = ?",
      values: [mediaId],
    });
    const row = result.values?.[0] as
      | {
          media_id: string;
          mime_type: string;
          sha256: string;
          data_base64: string;
        }
      | undefined;
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
    const result = await this.sqlite.query({
      database: this.database,
      statement:
        "SELECT media_id, mime_type, sha256, data_base64 FROM local_media ORDER BY media_id",
      values: [],
    });
    return (result.values ?? []).map((value) => {
      const row = value as {
        media_id: string;
        mime_type: string;
        sha256: string;
        data_base64: string;
      };
      return {
        mediaId: row.media_id,
        mimeType: row.mime_type,
        sha256: row.sha256,
        bytes: base64ToBytes(row.data_base64),
      };
    });
  }

  async delete(mediaId: string): Promise<void> {
    await this.initialize();
    await this.sqlite.run({
      database: this.database,
      statement: "DELETE FROM local_media WHERE media_id = ?",
      values: [mediaId],
      transaction: true,
    });
  }

  async isEmpty(): Promise<boolean> {
    return (await this.list()).length === 0;
  }
}

export const createLocalMediaStorage = (): LocalMediaStorage =>
  Capacitor.isNativePlatform()
    ? new NativeSqliteLocalMediaStorage()
    : new IndexedDbLocalMediaStorage();
