import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";
import { registerPlugin } from "@capacitor/core";

export const nativeDatabaseName = "flash-n-flip-local";
export const CapacitorSQLite =
  registerPlugin<CapacitorSQLitePlugin>("CapacitorSQLite");

export type NativeConnectionPlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "open"
>;

const connections = new WeakMap<object, Map<string, Promise<void>>>();

export const ensureNativeDatabaseConnection = (
  sqlite: NativeConnectionPlugin,
  database = nativeDatabaseName,
): Promise<void> => {
  let byDatabase = connections.get(sqlite as object);
  if (!byDatabase) {
    byDatabase = new Map();
    connections.set(sqlite as object, byDatabase);
  }
  const existing = byDatabase.get(database);
  if (existing) return existing;
  const opening = (async () => {
    await sqlite.createConnection({
      database,
      version: 1,
      encrypted: false,
      mode: "no-encryption",
      readonly: false,
    });
    await sqlite.open({ database, readonly: false });
  })();
  byDatabase.set(database, opening);
  return opening;
};
