import { describe, expect, it, vi } from "vitest";

import { ensureNativeDatabaseConnection } from "./native-database";

describe("native database connection lifecycle", () => {
  it("reuses the native connection after the WebView document changes", async () => {
    const connectDocumentSqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: false }),
      open: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi.fn().mockResolvedValue({ result: false }),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    };
    const productDocumentSqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "CreateConnection: Connection flash-n-flip-local-v2 already exists",
          ),
        ),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi.fn().mockResolvedValue({ result: false }),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    };

    await ensureNativeDatabaseConnection(
      connectDocumentSqlite,
      "document-handoff",
    );
    await ensureNativeDatabaseConnection(
      productDocumentSqlite,
      "document-handoff",
    );

    expect(connectDocumentSqlite.open).toHaveBeenCalledOnce();
    expect(productDocumentSqlite.createConnection).toHaveBeenCalledOnce();
    expect(productDocumentSqlite.isDBOpen).toHaveBeenCalledOnce();
    expect(productDocumentSqlite.isTransactionActive).toHaveBeenCalledOnce();
    expect(productDocumentSqlite.rollbackTransaction).not.toHaveBeenCalled();
    expect(productDocumentSqlite.open).not.toHaveBeenCalled();
  });

  it("rolls back an interrupted transaction before the next WebView document initializes", async () => {
    const calls: string[] = [];
    const sqlite = {
      createConnection: vi.fn().mockRejectedValue(
        new Error(
          "CreateConnection: Connection flash-n-flip-local-v2 already exists",
        ),
      ),
      isDBOpen: vi.fn().mockImplementation(async () => {
        calls.push("is-open");
        return { result: true };
      }),
      open: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi.fn().mockImplementation(async () => {
        calls.push("is-transaction-active");
        return { result: true };
      }),
      rollbackTransaction: vi.fn().mockImplementation(async () => {
        calls.push("rollback");
      }),
    };

    await ensureNativeDatabaseConnection(sqlite, "interrupted-document");

    expect(calls).toEqual([
      "is-open",
      "is-transaction-active",
      "rollback",
    ]);
    expect(sqlite.open).not.toHaveBeenCalled();
  });

  it("opens an existing native connection when its database is closed", async () => {
    const sqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "CreateConnection: Connection flash-n-flip-local-v2 already exists",
          ),
        ),
      isDBOpen: vi.fn().mockResolvedValue({ result: false }),
      open: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi.fn().mockResolvedValue({ result: false }),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    };

    await ensureNativeDatabaseConnection(sqlite, "closed-connection");

    expect(sqlite.isDBOpen).toHaveBeenCalledOnce();
    expect(sqlite.open).toHaveBeenCalledOnce();
    expect(sqlite.isTransactionActive).toHaveBeenCalledOnce();
  });

  it("creates a missing connection and permits a retry after failure", async () => {
    const sqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValueOnce(new Error("bridge reloading"))
        .mockResolvedValueOnce(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: false }),
      open: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi.fn().mockResolvedValue({ result: false }),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      ensureNativeDatabaseConnection(sqlite, "retry-connection"),
    ).rejects.toThrow("bridge reloading");
    await expect(
      ensureNativeDatabaseConnection(sqlite, "retry-connection"),
    ).resolves.toBeUndefined();

    expect(sqlite.createConnection).toHaveBeenCalledTimes(2);
    expect(sqlite.open).toHaveBeenCalledOnce();
  });
});
