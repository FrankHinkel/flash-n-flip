import { expect, it, vi } from "vitest";
const sqlite = vi.hoisted(() => ({
  createConnection: vi.fn(async () => {}),
  isDBOpen: vi.fn(async () => ({ result: true })),
  open: vi.fn(async () => {}),
  query: vi.fn(async (input: { values?: unknown[] }) => {
    if (!Array.isArray(input.values))
      throw new Error("Query: Must provide an Array of value");
    return {
      values: [
        { name: "local_authority_entities" },
        { name: "local_media" },
        { name: "cloud_durable_values" },
        { name: "sqlite_sequence" },
        { name: "unrelated_preferences" },
      ],
    };
  }),
  execute: vi.fn(async () => ({})),
}));
vi.mock("./native-database", () => ({
  CapacitorSQLite: sqlite,
  nativeDatabaseName: "flash-n-flip-local-v2",
  ensureNativeDatabaseConnection: async () => {},
  nativeSqliteRows: (rows: unknown[]) => rows,
  withNativeDatabaseLock: async (_name: string, fn: () => Promise<unknown>) =>
    fn(),
}));
import { eraseNativeLearnerTestData } from "./cloud-engine-test-reset";
it("supplies the required native query values and atomically clears only FNF data tables", async () => {
  await eraseNativeLearnerTestData();
  expect(sqlite.query).toHaveBeenCalledTimes(3);
  expect(sqlite.execute).toHaveBeenCalledTimes(3);
  for (const call of sqlite.execute.mock.calls as unknown as Array<
    [{ statements: string; transaction: boolean }]
  >) {
    expect(call[0].transaction).toBe(true);
    expect(call[0].statements).toContain(
      'DELETE FROM "local_authority_entities"',
    );
    expect(call[0].statements).toContain('DELETE FROM "cloud_durable_values"');
    expect(call[0].statements).not.toContain("unrelated_preferences");
    expect(call[0].statements).not.toContain("sqlite_sequence");
  }
});
