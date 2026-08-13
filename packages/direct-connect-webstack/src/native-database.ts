import type { CapacitorSQLitePlugin } from "@capacitor-community/sqlite";
import { registerPlugin } from "@capacitor/core";

export const legacyNativeDatabaseName = "flash-n-flip-local";
export const nativeDatabaseName = "flash-n-flip-local-v2";
export const CapacitorSQLite =
  registerPlugin<CapacitorSQLitePlugin>("CapacitorSQLite");

export const nativeSqliteRows = <T>(values: unknown[] | undefined): T[] =>
  (values ?? []).filter(
    (value) =>
      !(typeof value === "object" && value !== null && "ios_columns" in value),
  ) as T[];

export type NativeConnectionPlugin = Pick<
  CapacitorSQLitePlugin,
  "createConnection" | "isDBOpen" | "open"
> &
  Partial<
    Pick<CapacitorSQLitePlugin, "isTransactionActive" | "rollbackTransaction">
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

const errorMessage = (cause: unknown): string =>
  cause instanceof Error
    ? cause.message
    : typeof cause === "object" &&
        cause !== null &&
        "message" in cause &&
        typeof cause.message === "string"
      ? cause.message
      : String(cause);

const noNativeTransactionActive = (cause: unknown): boolean =>
  /cannot rollback\s*-\s*no transaction is active/i.test(errorMessage(cause));

export const rollbackNativeTransactionIfActive = async (
  sqlite: Pick<CapacitorSQLitePlugin, "rollbackTransaction"> &
    Partial<Pick<CapacitorSQLitePlugin, "isTransactionActive">>,
  database: string,
): Promise<void> => {
  if (sqlite.isTransactionActive) {
    const active = await sqlite.isTransactionActive({ database });
    if (!active.result) return;
  }
  try {
    await sqlite.rollbackTransaction({ database });
  } catch (cause) {
    if (!noNativeTransactionActive(cause)) throw cause;
  }
};

const recoverInterruptedDocumentTransaction = async (
  sqlite: NativeConnectionPlugin,
  database: string,
): Promise<void> => {
  if (!sqlite.isTransactionActive || !sqlite.rollbackTransaction)
    throw new Error(
      "Die vorhandene native SQLite-Verbindung kann nicht sicher übernommen werden.",
    );
  const active = await sqlite.isTransactionActive({ database });
  if (active.result) await sqlite.rollbackTransaction({ database });
};

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
      const message = errorMessage(cause);
      if (!connectionAlreadyExists(message)) throw cause;
      nativeConnectionExists = true;
    }
    if (nativeConnectionExists) {
      const openState = await sqlite.isDBOpen({ database, readonly: false });
      if (!openState.result) await sqlite.open({ database, readonly: false });
      await recoverInterruptedDocumentTransaction(sqlite, database);
      return;
    }
    await sqlite.open({ database, readonly: false });
  })().catch((cause) => {
    byDatabase?.delete(database);
    throw cause;
  });
  byDatabase.set(database, opening);
  return opening;
};
