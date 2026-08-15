import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalAuthorityRepository as ContractLocalAuthorityRepository } from "@flashcards/sync/local-authority";
import type {
  LocalAuthorityByteHasher,
  LocalAuthorityMutationValidator,
  LocalAuthorityStorage,
} from "@flashcards/sync/local-authority";

import {
  IndexedDbLocalAuthorityStorage,
  NativeSqliteLocalAuthorityStorage,
  webCryptoLocalAuthorityHasher,
  webLocalAuthorityDatabaseName,
} from "./local-authority-storage";

const deviceId = "00000000-0000-4000-8000-000000000201";
const deckId = "00000000-0000-4000-8000-000000000202";

const testMutationValidator: LocalAuthorityMutationValidator = (mutation) => {
  if (mutation.operation === "DELETE") return;
  if (typeof mutation.payload !== "object" || mutation.payload === null) {
    throw new Error("Structured test payload required");
  }
};

class LocalAuthorityRepository extends ContractLocalAuthorityRepository {
  constructor(
    storage: LocalAuthorityStorage,
    deviceId: string,
    hasher: LocalAuthorityByteHasher,
  ) {
    super(storage, deviceId, hasher, testMutationValidator);
  }
}

const deleteWebDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
};

afterEach(deleteWebDatabase);

describe("IndexedDB local authority adapter", () => {
  it("uses the entity-type projection without returning unrelated records", async () => {
    const repository = new LocalAuthorityRepository(
      new IndexedDbLocalAuthorityStorage(),
      deviceId,
      webCryptoLocalAuthorityHasher,
    );
    await repository.commitLocalMutations([
      {
        entityId: deckId,
        entityType: "DECK",
        operation: "UPSERT",
        baseVersion: null,
        payload: { title: "Indexed deck" },
      },
      {
        entityId: "00000000-0000-4000-8000-000000000205",
        entityType: "SETTING",
        operation: "UPSERT",
        baseVersion: null,
        payload: { theme: "dark" },
      },
    ]);

    expect(await repository.listEntities({ entityType: "DECK" })).toEqual([
      expect.objectContaining({
        winningMutation: expect.objectContaining({ entityId: deckId }),
      }),
    ]);
    await expect(repository.getEntity(deckId)).resolves.toMatchObject({
      winningMutation: expect.objectContaining({ entityId: deckId }),
    });
    await expect(repository.countOutbox()).resolves.toBe(2);
  });

  it("preserves the contract across repository instances and rolls back a batch", async () => {
    const repository = new LocalAuthorityRepository(
      new IndexedDbLocalAuthorityStorage(),
      deviceId,
      webCryptoLocalAuthorityHasher,
    );
    const first = await repository.commitLocalMutation({
      entityId: deckId,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: null,
      payload: { title: "Lokal" },
    });

    await expect(
      repository.commitLocalMutations([
        {
          entityId: "00000000-0000-4000-8000-000000000203",
          entityType: "SETTING",
          operation: "UPSERT",
          baseVersion: null,
          payload: { theme: "dark" },
        },
        {
          entityId: deckId,
          entityType: "DECK",
          operation: "UPSERT",
          baseVersion: 99,
          payload: { title: "Conflict" },
        },
      ]),
    ).rejects.toThrow(/version conflict/i);

    const restarted = new LocalAuthorityRepository(
      new IndexedDbLocalAuthorityStorage(),
      deviceId,
      webCryptoLocalAuthorityHasher,
    );
    expect(await restarted.listEntities({ includeDeleted: true })).toHaveLength(
      1,
    );
    expect((await restarted.listOutbox())[0]?.mutationId).toBe(
      first.mutationId,
    );
    const next = await restarted.commitLocalMutation({
      entityId: deckId,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: 1,
      payload: { title: "Nach Neustart" },
    });
    expect(next.originSequence).toBe(2);
  });

  it("exports and restores the complete IndexedDB state with hash verification", async () => {
    const repository = new LocalAuthorityRepository(
      new IndexedDbLocalAuthorityStorage(),
      deviceId,
      webCryptoLocalAuthorityHasher,
    );
    await repository.commitLocalMutation({
      entityId: deckId,
      entityType: "DECK",
      operation: "UPSERT",
      baseVersion: null,
      payload: { title: "Export" },
    });
    const backup = await repository.exportAll();
    await deleteWebDatabase();

    const restored = new LocalAuthorityRepository(
      new IndexedDbLocalAuthorityStorage(),
      "00000000-0000-4000-8000-000000000204",
      webCryptoLocalAuthorityHasher,
    );
    await restored.restoreAll(backup);
    expect((await restored.listEntities())[0]?.winningMutation.payload).toEqual(
      { title: "Export" },
    );
  });
});

describe("native SQLite local authority adapter", () => {
  it("creates the durable tables and rolls back an interrupted transaction", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute,
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "contract-test",
    );

    await expect(
      storage.transaction("readwrite", async () => {
        throw new Error("simulated process interruption");
      }),
    ).rejects.toThrow("simulated process interruption");
    expect(sqlite.rollbackTransaction).toHaveBeenCalledOnce();
    expect(sqlite.commitTransaction).not.toHaveBeenCalled();
    expect(execute.mock.calls[0]?.[0].statements).toMatch(
      /local_authority_outbox[\s\S]*foreign key/i,
    );
  });

  it("preserves the operation error when SQLite already ended the transaction", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi.fn().mockResolvedValue({ result: false }),
      rollbackTransaction: vi
        .fn()
        .mockRejectedValue(
          new Error("cannot rollback - no transaction is active"),
        ),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "already-ended-transaction-test",
    );

    await expect(
      storage.transaction("readonly", async () => {
        throw new Error("original deck query failure");
      }),
    ).rejects.toThrow("original deck query failure");
    expect(sqlite.isTransactionActive).toHaveBeenCalledOnce();
    expect(sqlite.rollbackTransaction).not.toHaveBeenCalled();
  });

  it("commits a successful transaction and passes explicit query values", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "contract-test",
    );

    await expect(
      storage.transaction("readonly", (transaction) =>
        transaction.getMetadata(),
      ),
    ).resolves.toBeNull();
    expect(sqlite.query).toHaveBeenCalledWith(
      expect.objectContaining({ values: [] }),
    );
    expect(sqlite.commitTransaction).toHaveBeenCalledOnce();
    expect(sqlite.rollbackTransaction).not.toHaveBeenCalled();
  });

  it("pushes entity-type filtering into the native SQLite query", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "entity-type-test",
    );

    await storage.transaction("readonly", (transaction) =>
      transaction.listEntities({ entityType: "DECK" }),
    );

    expect(sqlite.query).toHaveBeenCalledWith(
      expect.objectContaining({
        statement: expect.stringContaining("winningMutation.entityType"),
        values: ["DECK"],
      }),
    );
  });

  it("ignores the iOS column metadata row in non-empty query results", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        values: [
          { ios_columns: ["device_id", "next_origin_sequence"] },
          { device_id: deviceId, next_origin_sequence: 12 },
        ],
      }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "contract-test",
    );

    await expect(
      storage.transaction("readonly", (transaction) =>
        transaction.getMetadata(),
      ),
    ).resolves.toEqual({ deviceId, nextOriginSequence: 12 });
  });

  it("reads the highest native origin sequence for metadata repair", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi
        .fn()
        .mockImplementation(async ({ statement }: { statement: string }) =>
          statement.includes("MAX(origin_sequence)")
            ? { values: [{ maximum_origin_sequence: 41 }] }
            : { values: [] },
        ),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "sequence-repair-test",
    );

    await expect(
      storage.transaction("readonly", (transaction) =>
        transaction.getMaximumOriginSequence(deviceId),
      ),
    ).resolves.toBe(41);
  });

  it("repairs a stale Keychain identity sequence before a native mutation", async () => {
    const run = vi.fn(
      async (_input: { statement: string; values: unknown[] }) => ({
        changes: { changes: 1 },
      }),
    );
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined),
      run,
      query: vi
        .fn()
        .mockImplementation(async ({ statement }: { statement: string }) => {
          if (statement.includes("FROM local_authority_metadata")) {
            return {
              values: [{ device_id: deviceId, next_origin_sequence: 1 }],
            };
          }
          if (statement.includes("MAX(origin_sequence)")) {
            return { values: [{ maximum_origin_sequence: 41 }] };
          }
          if (statement.includes("FROM local_authority_watermarks")) {
            return { values: [{ sequence: 41 }] };
          }
          return { values: [] };
        }),
    };
    const repository = new LocalAuthorityRepository(
      new NativeSqliteLocalAuthorityStorage(sqlite, "reinstall-repair-test"),
      deviceId,
      webCryptoLocalAuthorityHasher,
    );

    const mutation = await repository.commitLocalMutation({
      entityId: "00000000-0000-4000-8000-000000000205",
      entityType: "SETTING",
      operation: "UPSERT",
      baseVersion: null,
      payload: { locale: "de" },
    });

    expect(mutation.originSequence).toBe(42);
    const mutationInsert = run.mock.calls.find(([input]) =>
      input.statement.includes("INSERT INTO local_authority_mutations"),
    )?.[0];
    expect(mutationInsert?.values[2]).toBe(42);
    expect(sqlite.rollbackTransaction).not.toHaveBeenCalled();
    expect(sqlite.commitTransaction).toHaveBeenCalledOnce();
  });

  it("serializes concurrent transactions on the shared native connection", async () => {
    let activeTransactions = 0;
    let maximumActiveTransactions = 0;
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockImplementation(async () => {
        activeTransactions += 1;
        maximumActiveTransactions = Math.max(
          maximumActiveTransactions,
          activeTransactions,
        );
      }),
      commitTransaction: vi.fn().mockImplementation(async () => {
        activeTransactions -= 1;
      }),
      rollbackTransaction: vi.fn().mockImplementation(async () => {
        activeTransactions -= 1;
      }),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "contract-test",
    );

    const reads = Array.from({ length: 8 }, () =>
      storage.transaction("readonly", async (transaction) => {
        await Promise.resolve();
        return transaction.listEntities();
      }),
    );

    await expect(Promise.all(reads)).resolves.toEqual(
      Array.from({ length: 8 }, () => []),
    );
    expect(sqlite.beginTransaction).toHaveBeenCalledTimes(8);
    expect(sqlite.commitTransaction).toHaveBeenCalledTimes(8);
    expect(maximumActiveTransactions).toBe(1);
    expect(activeTransactions).toBe(0);
  });

  it("recovers an interrupted transaction before initializing in a new WebView document", async () => {
    let transactionActive = true;
    const sqlite = {
      createConnection: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "CreateConnection: Connection flash-n-flip-local-v2 already exists",
          ),
        ),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      isTransactionActive: vi
        .fn()
        .mockImplementation(async () => ({ result: transactionActive })),
      execute: vi.fn().mockImplementation(async () => {
        if (transactionActive)
          throw new Error(
            "Execute: Failed in executeSQL : Error beginTransaction: failed rc: 1 message: cannot start a transaction within a transaction",
          );
      }),
      beginTransaction: vi.fn().mockImplementation(async () => {
        transactionActive = true;
      }),
      commitTransaction: vi.fn().mockImplementation(async () => {
        transactionActive = false;
      }),
      rollbackTransaction: vi.fn().mockImplementation(async () => {
        transactionActive = false;
      }),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const storage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "interrupted-initialization-test",
    );

    await expect(
      storage.transaction("readonly", (transaction) =>
        transaction.listEntities(),
      ),
    ).resolves.toEqual([]);

    expect(sqlite.rollbackTransaction).toHaveBeenCalledOnce();
    expect(sqlite.execute).toHaveBeenCalledOnce();
    expect(sqlite.beginTransaction).toHaveBeenCalledOnce();
    expect(sqlite.commitTransaction).toHaveBeenCalledOnce();
    expect(transactionActive).toBe(false);
  });

  it("serializes transactions across repository instances using the same native database", async () => {
    let activeTransactions = 0;
    let maximumActiveTransactions = 0;
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      beginTransaction: vi.fn().mockImplementation(async () => {
        activeTransactions += 1;
        maximumActiveTransactions = Math.max(
          maximumActiveTransactions,
          activeTransactions,
        );
        if (activeTransactions > 1) {
          throw new Error(
            "Execute failed: Error begin transaction: cannot start a transaction within a transaction",
          );
        }
      }),
      commitTransaction: vi.fn().mockImplementation(async () => {
        activeTransactions -= 1;
      }),
      rollbackTransaction: vi.fn().mockImplementation(async () => {
        activeTransactions -= 1;
      }),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ values: [] }),
    };
    const connectControllerStorage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "handoff-test",
    );
    const productAppStorage = new NativeSqliteLocalAuthorityStorage(
      sqlite,
      "handoff-test",
    );

    await expect(
      Promise.all([
        connectControllerStorage.transaction("readwrite", async () => {
          await Promise.resolve();
          await Promise.resolve();
        }),
        productAppStorage.transaction("readonly", async (transaction) => {
          await Promise.resolve();
          return transaction.listEntities();
        }),
      ]),
    ).resolves.toEqual([undefined, []]);

    expect(sqlite.beginTransaction).toHaveBeenCalledTimes(2);
    expect(sqlite.commitTransaction).toHaveBeenCalledTimes(2);
    expect(maximumActiveTransactions).toBe(1);
    expect(activeTransactions).toBe(0);
  });
});
