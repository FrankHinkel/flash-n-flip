import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import {
  cloudAssetManifestSchema, cloudLibraryBindingSchema, cloudLibraryIdentitySchema,
  type CloudAssetManifest, type CloudLibraryIdentity,
} from "@flashcards/domain/cloud-library";
import {
  confirmCloudLibraryBinding, reserveCloudLibraryBinding,
  type CloudLibraryBindingRepository,
} from "@flashcards/sync/cloud-library-bootstrap";
import { cloudAssetChunkBytes, type CloudAssetStaging } from "@flashcards/sync/cloud-library-assets";
import {
  CapacitorSQLite, ensureNativeDatabaseConnection, nativeSqliteRows,
  rollbackNativeTransactionIfActive, withNativeDatabaseLock,
} from "./native-database";

// Separate from learner entities. A failed/partial download never becomes an
// installed media reference. Neither logout nor adapter construction clears it.
const databaseName = "flash-n-flip-cloud-staging-v1";
type NativeSqlite = Pick<CapacitorSQLitePlugin,
  "createConnection" | "isDBOpen" | "open" | "execute" | "query" | "run" |
  "beginTransaction" | "commitTransaction" | "rollbackTransaction" | "isTransactionActive">;

export interface CloudDurableKeyValue {
  read(key: string): Promise<string | null>;
  update(key: string, change: (current: string | null) => string): Promise<string>;
}

export function createNativeCloudKeyValue(
  sqlite: NativeSqlite = CapacitorSQLite,
  database = databaseName,
): CloudDurableKeyValue {
  const access = <T>(operation: () => Promise<T>): Promise<T> =>
    withNativeDatabaseLock(database, async () => {
      await ensureNativeDatabaseConnection(sqlite, database);
      await sqlite.execute({ database, statements:
        "CREATE TABLE IF NOT EXISTS cloud_durable_values (entry_key TEXT PRIMARY KEY NOT NULL, entry_value TEXT NOT NULL);",
        transaction: false });
      return operation();
    });
  const read = async (key: string): Promise<string | null> => {
    const result = await sqlite.query({ database,
      statement: "SELECT entry_value FROM cloud_durable_values WHERE entry_key = ?;", values: [key] });
    return nativeSqliteRows<{ entry_value: string }>(result.values)[0]?.entry_value ?? null;
  };
  return {
    read: (key) => access(() => read(key)),
    update: (key, change) => access(async () => {
      await sqlite.beginTransaction({ database });
      try {
        const value = change(await read(key));
        await sqlite.run({ database, statement:
          "INSERT INTO cloud_durable_values(entry_key, entry_value) VALUES (?, ?) ON CONFLICT(entry_key) DO UPDATE SET entry_value = excluded.entry_value;",
          values: [key, value], transaction: false });
        await sqlite.commitTransaction({ database });
        return value;
      } catch (error) {
        await rollbackNativeTransactionIfActive(sqlite, database);
        throw error;
      }
    }),
  };
}

export function createBrowserCloudKeyValue(database = databaseName): CloudDurableKeyValue {
  const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("values"); };
    request.onerror = () => reject(request.error ?? new Error("Cloud staging database unavailable"));
    request.onblocked = () => reject(new Error("Close the other app tab to open cloud staging"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
  const access = async (key: string, change?: (current: string | null) => string): Promise<string | null> => {
    const db = await open();
    try {
      return await new Promise<string | null>((resolve, reject) => {
        const tx = db.transaction("values", change ? "readwrite" : "readonly");
        let value: string | null = null;
        let failure: unknown;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(failure ?? tx.error ?? new Error("Cloud staging transaction aborted"));
        tx.onerror = () => { /* onabort reports the durable transaction outcome. */ };
        const store = tx.objectStore("values");
        const request = store.get(key);
        request.onsuccess = () => {
          try {
            if (request.result !== undefined && typeof request.result !== "string")
              throw new Error("Invalid cloud staging value");
            value = request.result ?? null;
            if (change) { value = change(value); store.put(value, key); }
          } catch (error) { failure = error; tx.abort(); }
        };
      });
    } finally { db.close(); }
  };
  return { read: (key) => access(key), update: async (key, change) => (await access(key, change))! };
}

export function createNativeCloudLibraryBindings(
  values: CloudDurableKeyValue = createNativeCloudKeyValue(),
): CloudLibraryBindingRepository {
  const parse = (value: string | null) => value === null ? null : cloudLibraryBindingSchema.parse(JSON.parse(value));
  return {
    async read(environment) {
      const binding = parse(await values.read(`binding.${environment}`));
      if (binding && binding.environment !== environment) throw new Error("Cloud binding environment mismatch");
      return binding;
    },
    async reserve(candidate) {
      return cloudLibraryBindingSchema.parse(JSON.parse(await values.update(`binding.${candidate.environment}`,
        (value) => JSON.stringify(reserveCloudLibraryBinding(parse(value), candidate)))));
    },
    async confirm(expected, root) {
      await values.update(`binding.${expected.environment}`,
        (value) => JSON.stringify(confirmCloudLibraryBinding(parse(value), expected, root)));
    },
  };
}

export function createCloudAssetStaging(input: {
  environment: "development" | "production";
  account: string;
  identity: CloudLibraryIdentity;
  manifest: CloudAssetManifest;
  values?: CloudDurableKeyValue;
}): CloudAssetStaging {
  if (!input.account || input.account.length > 1024 ||
      !["development", "production"].includes(input.environment)) throw new Error("Invalid cloud staging account");
  const identity = cloudLibraryIdentitySchema.parse(input.identity);
  const manifest = cloudAssetManifestSchema.parse(input.manifest);
  if (manifest.chunks.some((chunk, i) => chunk.byteSize > cloudAssetChunkBytes ||
      (i < manifest.chunks.length - 1 && chunk.byteSize !== cloudAssetChunkBytes)))
    throw new Error("Unsupported cloud staging chunk layout");
  const values = input.values ?? (Capacitor.isNativePlatform() ? createNativeCloudKeyValue() : createBrowserCloudKeyValue());
  // JSON tuple avoids delimiter collisions in opaque account identifiers.
  const key = (index: number): string => {
    if (!Number.isSafeInteger(index) || !manifest.chunks[index]) throw new Error("Invalid cloud chunk index");
    return JSON.stringify(["chunk", input.environment, input.account, identity.libraryId,
      identity.libraryGeneration, manifest.sha256, manifest.chunks[index]!.sha256, index]);
  };
  return {
    async readChunk(index) {
      const value = await values.read(key(index));
      if (value === null) return null;
      if (value.length > Math.ceil(cloudAssetChunkBytes / 3) * 4) return null;
      try {
        const binary = atob(value);
        if (binary.length !== manifest.chunks[index]!.byteSize) return null;
        return Uint8Array.from(binary, (char) => char.charCodeAt(0));
      } catch { return null; } // The transfer re-fetches corrupt staging chunks.
    },
    async writeChunk(index, bytes) {
      const entryKey = key(index);
      if (bytes.byteLength !== manifest.chunks[index]!.byteSize) throw new Error("Cloud staging chunk size mismatch");
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const encoded = btoa(binary);
      await values.update(entryKey, () => encoded);
    },
  };
}
