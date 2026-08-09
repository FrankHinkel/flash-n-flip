import { Capacitor, registerPlugin } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";

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

const nativeDatabaseName = "flash-n-flip-local";
export const webLocalAuthorityDatabaseName = "flash-n-flip-local-authority";

const CapacitorSQLite =
  registerPlugin<CapacitorSQLitePlugin>("CapacitorSQLite");

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

type SqlitePlugin = Pick<
  CapacitorSQLitePlugin,
  | "createConnection"
  | "open"
  | "execute"
  | "beginTransaction"
  | "commitTransaction"
  | "rollbackTransaction"
  | "run"
  | "query"
>;

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

const openWebDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(webLocalAuthorityDatabaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore("metadata");
      database.createObjectStore("entities", { keyPath: "entityId" });
      database.createObjectStore("mutations", { keyPath: "mutationId" });
      database.createObjectStore("outbox", { keyPath: "mutationId" });
      database.createObjectStore("watermarks", { keyPath: "originDeviceId" });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

type IndexedEntity = {
  entityId: string;
  entity: LocalMaterializedEntity;
};

export class IndexedDbLocalAuthorityStorage implements LocalAuthorityStorage {
  async transaction<T>(
    mode: "readonly" | "readwrite",
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    const database = await openWebDatabase();
    const nativeTransaction = database.transaction(
      ["metadata", "entities", "mutations", "outbox", "watermarks"],
      mode,
    );
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
            entity,
          } satisfies IndexedEntity),
        );
      },
      listEntities: async () =>
        ((await requestResult(entities.getAll())) as IndexedEntity[]).map(
          (entry) => entry.entity,
        ),
      getMutation: async (mutationId) =>
        ((await requestResult(mutations.get(mutationId))) as
          PeerMutation | undefined) ?? null,
      putMutation: async (mutation) => {
        await requestResult(mutations.put(mutation));
      },
      listMutations: async () =>
        (await requestResult(mutations.getAll())) as PeerMutation[],
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
      await this.sqlite.createConnection({
        database: this.database,
        version: 1,
        encrypted: false,
        mode: "no-encryption",
        readonly: false,
      });
      await this.sqlite.open({ database: this.database, readonly: false });
      await this.sqlite.execute({
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
      });
    })();
    return this.ready;
  }

  async transaction<T>(
    _mode: "readonly" | "readwrite",
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    await this.initialize();
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
      return (result.values?.[0] as T | undefined) ?? null;
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
      return (result.values ?? []) as T[];
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
      listEntities: async () =>
        (
          await queryAll<{ record_json: string }>(
            "SELECT record_json FROM local_authority_entities ORDER BY entity_id",
          )
        ).map((row) => JSON.parse(row.record_json) as LocalMaterializedEntity),
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
      listMutations: async () =>
        (
          await queryAll<{ record_json: string }>(
            `SELECT record_json FROM local_authority_mutations
             ORDER BY origin_device_id, origin_sequence`,
          )
        ).map((row) => JSON.parse(row.record_json) as PeerMutation),
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
      await this.sqlite.rollbackTransaction({ database: this.database });
      throw cause;
    }
  }
}

export const createLocalAuthorityStorage = (): LocalAuthorityStorage =>
  Capacitor.isNativePlatform()
    ? new NativeSqliteLocalAuthorityStorage()
    : new IndexedDbLocalAuthorityStorage();
