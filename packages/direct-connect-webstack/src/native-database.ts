import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";
import { registerPlugin } from "@capacitor/core";

export const legacyNativeDatabaseName = "flash-n-flip-local";
export const nativeDatabaseName = "flash-n-flip-local-v2";
export const CapacitorSQLite =
  registerPlugin<CapacitorSQLitePlugin>("CapacitorSQLite");

export type NativeConnectionPlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "isDBOpen" | "open"
>;

const connections = new WeakMap<object, Map<string, Promise<void>>>();

type NativeDatabaseOperationGlobal = typeof globalThis & {
  __flashNFlipNativeDatabaseOperationTails?: Map<string, Promise<void>>;
};

const nativeDatabaseOperationTails = (): Map<string, Promise<void>> => {
  const sharedGlobal = globalThis as NativeDatabaseOperationGlobal;
  sharedGlobal.__flashNFlipNativeDatabaseOperationTails ??= new Map();
  return sharedGlobal.__flashNFlipNativeDatabaseOperationTails;
};

export const withNativeDatabaseLock = async <T>(
  database: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const tails = nativeDatabaseOperationTails();
  const previous = tails.get(database) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  tails.set(database, tail);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    void tail.then(() => {
      if (tails.get(database) === tail) tails.delete(database);
    });
  }
};

const connectionAlreadyExists = (message: string): boolean =>
  /^(?:CreateConnection:\s*)?Connection .+ already exists$/.test(message);

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
    let nativeConnectionExists = false;
    try {
      await sqlite.createConnection({
        database,
        version: 1,
        encrypted: false,
        mode: "no-encryption",
        readonly: false,
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : typeof cause === "object" &&
              cause !== null &&
              "message" in cause &&
              typeof cause.message === "string"
            ? cause.message
            : String(cause);
      if (!connectionAlreadyExists(message)) throw cause;
      nativeConnectionExists = true;
    }
    if (nativeConnectionExists) {
      const openState = await sqlite.isDBOpen({ database, readonly: false });
      if (openState.result) return;
    }
    await sqlite.open({ database, readonly: false });
  })().catch((cause) => {
    byDatabase?.delete(database);
    throw cause;
  });
  byDatabase.set(database, opening);
  return opening;
};
