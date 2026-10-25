import {
  CapacitorSQLite,
  ensureNativeDatabaseConnection,
  nativeDatabaseName,
  nativeSqliteRows,
  withNativeDatabaseLock,
} from "./native-database";

// Explicit, development-only test-library erasure. One SQL transaction per app
// database, rather than tens of thousands of bridge calls per entity. Device
// identity and device-local typography/preferences live in other stores.
export async function eraseNativeLearnerTestData(): Promise<void> {
  for (const database of [
    nativeDatabaseName,
    "flash-n-flip-local",
    "flash-n-flip-cloud-staging-v1",
  ]) {
    await withNativeDatabaseLock(database, async () => {
      await ensureNativeDatabaseConnection(CapacitorSQLite, database);
      const result = await CapacitorSQLite.query({
        database,
        statement:
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        values: [],
      });
      const tables = nativeSqliteRows<{ name: string }>(result.values)
        .map((row) => row.name)
        .filter((name) => /^(local_|cloud_)/.test(name));
      if (tables.length)
        await CapacitorSQLite.execute({
          database,
          statements: tables
            .map((name) => `DELETE FROM "${name.replaceAll('"', '""')}";`)
            .join("\n"),
          transaction: true,
        });
    });
  }
}
