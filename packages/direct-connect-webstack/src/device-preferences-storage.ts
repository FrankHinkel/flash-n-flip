import { Capacitor } from "@capacitor/core";
import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";
import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  nativeSqliteRows,
  withNativeDatabaseLock,
} from "./native-database";

// Deliberately separate from library entities, replication and library backups.
export const devicePreferencesDatabase = "flash-n-flip-device-preferences";
export interface DevicePreferencesStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export class IndexedDbDevicePreferences implements DevicePreferencesStorage {
  constructor(private readonly name = devicePreferencesDatabase) {}

  private async access<T>(
    mode: IDBTransactionMode,
    key: string,
    value?: string,
  ): Promise<T> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("preferences");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Device preferences database is blocked"));
    });
    try {
      return await new Promise<T>((resolve, reject) => {
        const transaction = database.transaction("preferences", mode);
        const store = transaction.objectStore("preferences");
        const request =
          mode === "readonly" ? store.get(key) : store.put(value, key);
        transaction.oncomplete = () => resolve((request.result ?? null) as T);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }
  get(key: string): Promise<string | null> {
    return this.access("readonly", key);
  }
  async set(key: string, value: string): Promise<void> {
    await this.access("readwrite", key, value);
  }
}

type Sqlite = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "isDBOpen" | "open" | "execute" | "query" | "run"
>;
export class NativeDevicePreferences implements DevicePreferencesStorage {
  private ready: Promise<void> | undefined;
  constructor(
    private readonly sqlite: Sqlite = CapacitorSQLite,
    private readonly name = devicePreferencesDatabase,
  ) {}
  private async initialize() {
    this.ready ??= (async () => {
      await ensureNativeDatabaseConnection(this.sqlite, this.name);
      await withNativeDatabaseLock(this.name, () =>
        this.sqlite.execute({
          database: this.name,
          transaction: true,
          statements:
            "CREATE TABLE IF NOT EXISTS device_preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
        }),
      );
    })().catch((cause) => {
      this.ready = undefined;
      throw cause;
    });
    await this.ready;
  }
  async get(key: string): Promise<string | null> {
    await this.initialize();
    return withNativeDatabaseLock(this.name, async () => {
      const result = await this.sqlite.query({
        database: this.name,
        statement: "SELECT value FROM device_preferences WHERE key = ?",
        values: [key],
      });
      return (
        nativeSqliteRows<{ value: string }>(result.values)[0]?.value ?? null
      );
    });
  }
  async set(key: string, value: string): Promise<void> {
    await this.initialize();
    await withNativeDatabaseLock(this.name, () =>
      this.sqlite.run({
        database: this.name,
        transaction: true,
        statement:
          "INSERT INTO device_preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        values: [key, value],
      }),
    );
  }
}

let storage: DevicePreferencesStorage | undefined;
export const devicePreferencesStorage = (): DevicePreferencesStorage =>
  (storage ??= Capacitor.isNativePlatform()
    ? new NativeDevicePreferences()
    : new IndexedDbDevicePreferences());
