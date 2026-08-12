import { describe, expect, it } from "vitest";

import type {
  LocalAuthorityMetadata,
  LocalMaterializedEntity,
  LocalMutationInput,
} from "@flashcards/domain/local-authority";
import type {
  PeerMutation,
  ReplicaWatermarks,
} from "@flashcards/domain/device-sync";

import {
  hashLocalAuthorityPayload,
  LocalAuthorityRepository as ContractLocalAuthorityRepository,
  maximumLocalMutationBatchSize,
} from "./local-authority";
import type {
  LocalAuthorityByteHasher,
  LocalAuthorityMutationValidator,
  LocalAuthorityStorage,
  LocalAuthorityTransaction,
} from "./local-authority";

const webCryptoHasher: LocalAuthorityByteHasher = async (bytes) => {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const testMutationValidator: LocalAuthorityMutationValidator = (mutation) => {
  if (mutation.operation === "DELETE") {
    if (mutation.payload !== null)
      throw new Error("Tombstone payload is invalid");
    return;
  }
  if (
    typeof mutation.payload !== "object" ||
    mutation.payload === null ||
    Array.isArray(mutation.payload)
  ) {
    throw new Error("Structured local payload required");
  }
  const payload = mutation.payload as Record<string, unknown>;
  if (
    mutation.entityType === "DECK" &&
    (typeof payload.title !== "string" || payload.title.length > 120)
  ) {
    throw new Error("Deck payload is invalid");
  }
  if (
    mutation.entityType === "REVIEW" &&
    (typeof payload.deckId !== "string" || typeof payload.rating !== "string")
  ) {
    throw new Error("Review payload is invalid");
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

type MemoryState = {
  metadata: LocalAuthorityMetadata | null;
  entities: Map<string, LocalMaterializedEntity>;
  mutations: Map<string, PeerMutation>;
  outbox: Set<string>;
  watermarks: Map<string, number>;
};

const emptyState = (): MemoryState => ({
  metadata: null,
  entities: new Map(),
  mutations: new Map(),
  outbox: new Set(),
  watermarks: new Map(),
});

class MemoryLocalAuthorityStorage implements LocalAuthorityStorage {
  private state = emptyState();

  async transaction<T>(
    mode: "readonly" | "readwrite",
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T> {
    const working = structuredClone(this.state);
    const transaction: LocalAuthorityTransaction = {
      getMetadata: async () => structuredClone(working.metadata),
      putMetadata: async (metadata) => {
        working.metadata = structuredClone(metadata);
      },
      getEntity: async (entityId) =>
        structuredClone(working.entities.get(entityId) ?? null),
      putEntity: async (entity) => {
        working.entities.set(
          entity.winningMutation.entityId,
          structuredClone(entity),
        );
      },
      deleteEntity: async (entityId) => {
        working.entities.delete(entityId);
      },
      listEntities: async () => structuredClone([...working.entities.values()]),
      getMutation: async (mutationId) =>
        structuredClone(working.mutations.get(mutationId) ?? null),
      putMutation: async (mutation) => {
        working.mutations.set(mutation.mutationId, structuredClone(mutation));
      },
      deleteMutation: async (mutationId) => {
        working.mutations.delete(mutationId);
      },
      listMutations: async () =>
        structuredClone([...working.mutations.values()]),
      getMaximumOriginSequence: async (originDeviceId) =>
        Math.max(
          0,
          ...[...working.mutations.values()]
            .filter((mutation) => mutation.originDeviceId === originDeviceId)
            .map((mutation) => mutation.originSequence),
        ),
      putOutboxMutationId: async (mutationId) => {
        working.outbox.add(mutationId);
      },
      deleteOutboxMutationId: async (mutationId) => {
        working.outbox.delete(mutationId);
      },
      listOutboxMutationIds: async () => [...working.outbox],
      getWatermark: async (originDeviceId) =>
        working.watermarks.get(originDeviceId) ?? 0,
      putWatermark: async (originDeviceId, sequence) => {
        working.watermarks.set(originDeviceId, sequence);
      },
      listWatermarks: async () =>
        Object.fromEntries(working.watermarks) as ReplicaWatermarks,
    };
    const result = await operation(transaction);
    if (mode === "readwrite") this.state = working;
    return result;
  }
}

const deviceA = "00000000-0000-4000-8000-000000000101";
const deviceB = "00000000-0000-4000-8000-000000000102";
const deviceC = "00000000-0000-4000-8000-000000000103";
const deckId = "00000000-0000-4000-8000-000000000111";
const reviewId = "00000000-0000-4000-8000-000000000112";

const deckMutation = (
  title: string,
  options: Partial<LocalMutationInput> = {},
): LocalMutationInput => ({
  entityId: deckId,
  entityType: "DECK",
  operation: "UPSERT",
  baseVersion: null,
  payload: { title },
  modifiedAt: "2026-08-09T15:00:00.000Z",
  ...options,
});

describe("local authority repository contract", () => {
  it("allows explicit atomic import batches up to 100,000 entries", async () => {
    const repository = new ContractLocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
      testMutationValidator,
    );

    expect(maximumLocalMutationBatchSize).toBe(100_000);
    await expect(
      repository.commitLocalMutations([deckMutation("Large import")], {
        maximumBatchSize: maximumLocalMutationBatchSize,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      repository.commitLocalMutations(
        [deckMutation("Too large", { baseVersion: 1 })],
        { maximumBatchSize: maximumLocalMutationBatchSize + 1 },
      ),
    ).rejects.toThrow("Invalid local mutation batch limit");
  });

  it("commits entities, stable sequences and the durable outbox atomically", async () => {
    const storage = new MemoryLocalAuthorityStorage();
    const repository = new LocalAuthorityRepository(
      storage,
      deviceA,
      webCryptoHasher,
    );
    const mutations = await repository.commitLocalMutations([
      deckMutation("Offline"),
      {
        entityId: reviewId,
        entityType: "REVIEW",
        operation: "UPSERT",
        baseVersion: null,
        payload: { deckId, rating: "GOOD" },
        modifiedAt: "2026-08-09T15:01:00.000Z",
      },
    ]);

    expect(mutations.map((mutation) => mutation.originSequence)).toEqual([
      1, 2,
    ]);
    expect(
      (await repository.listOutbox()).map((entry) => entry.mutationId),
    ).toEqual(mutations.map((entry) => entry.mutationId));

    const failedEntityId = "00000000-0000-4000-8000-000000000113";
    await expect(
      repository.commitLocalMutations([
        deckMutation("Would be rolled back", {
          entityId: failedEntityId,
        }),
        deckMutation("Conflict", { baseVersion: 99 }),
      ]),
    ).rejects.toThrow(/version conflict/i);
    expect(
      await repository.listEntities({ includeDeleted: true }),
    ).toHaveLength(2);
    expect(await repository.listOutbox()).toHaveLength(2);

    const next = await repository.commitLocalMutation(
      deckMutation("Updated", { baseVersion: 1 }),
    );
    expect(next.originSequence).toBe(3);

    const restarted = new LocalAuthorityRepository(
      storage,
      deviceA,
      webCryptoHasher,
    );
    expect(await restarted.listOutbox()).toHaveLength(3);
    expect(
      (await restarted.listEntities({ entityType: "DECK" }))[0]?.winningMutation
        .payload,
    ).toEqual({ title: "Updated" });
  });

  it("uses an explicit empty-library checkpoint to retire obsolete outbox history", async () => {
    const repository = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    const mutations = await repository.commitLocalMutations([
      deckMutation("Temporary"),
      deckMutation("Deleted", {
        operation: "DELETE",
        baseVersion: 1,
        payload: null,
      }),
    ]);

    await repository.acknowledgeOutboxThrough({ [deviceA]: 1 });
    expect(await repository.listOutbox()).toEqual([mutations[1]]);

    await repository.acknowledgeOutboxThrough({ [deviceA]: 2 });
    expect(await repository.listOutbox()).toEqual([]);
  });

  it("advances but never regresses an explicitly accepted empty-library checkpoint", async () => {
    const repository = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );

    await expect(
      repository.acceptEmptyLibraryCheckpoint({ [deviceB]: 75_461 }),
    ).resolves.toMatchObject({ [deviceB]: 75_461 });
    await expect(
      repository.acceptEmptyLibraryCheckpoint({ [deviceB]: 12 }),
    ).resolves.toMatchObject({ [deviceB]: 75_461 });
  });

  it("removes obsolete deck and learning history but retains settings at an empty-library checkpoint", async () => {
    const storage = new MemoryLocalAuthorityStorage();
    const repository = new LocalAuthorityRepository(
      storage,
      deviceA,
      webCryptoHasher,
    );
    await repository.commitLocalMutations([
      deckMutation("Temporary"),
      deckMutation("Deleted", {
        operation: "DELETE",
        baseVersion: 1,
        payload: null,
      }),
      {
        entityId: "00000000-0000-4000-8000-000000000114",
        entityType: "SETTING",
        operation: "UPSERT",
        baseVersion: null,
        payload: { locale: "de" },
      },
    ]);

    await expect(
      repository.acceptEmptyLibraryCheckpoint({ [deviceB]: 9 }),
    ).resolves.toMatchObject({ [deviceB]: 9 });
    const restarted = new LocalAuthorityRepository(
      storage,
      deviceA,
      webCryptoHasher,
    );
    expect(
      await restarted.listEntities({
        entityType: "DECK",
        includeDeleted: true,
      }),
    ).toEqual([]);
    expect(await restarted.listMutationJournal()).toHaveLength(1);
    expect((await restarted.listMutationJournal())[0]?.entityType).toBe(
      "SETTING",
    );
    expect(await restarted.getReplicaWatermarks()).toMatchObject({
      [deviceA]: 3,
      [deviceB]: 9,
    });
  });

  it("sorts reordered delivery, ignores exact duplicates and rejects gaps", async () => {
    const source = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    await source.commitLocalMutations([
      deckMutation("Direct"),
      {
        entityId: reviewId,
        entityType: "REVIEW",
        operation: "UPSERT",
        baseVersion: null,
        payload: { deckId, rating: "EASY" },
      },
    ]);
    const outgoing = await source.listOutbox();
    const targetStorage = new MemoryLocalAuthorityStorage();
    const target = new LocalAuthorityRepository(
      targetStorage,
      deviceB,
      webCryptoHasher,
    );

    await expect(
      target.applyRemoteMutations([...outgoing].reverse()),
    ).resolves.toEqual({ [deviceA]: 2 });
    await expect(target.applyRemoteMutations(outgoing)).resolves.toEqual({
      [deviceA]: 2,
    });
    expect(await target.listEntities()).toHaveLength(2);

    const restarted = new LocalAuthorityRepository(
      targetStorage,
      deviceB,
      webCryptoHasher,
    );
    expect(await restarted.getReplicaWatermarks()).toEqual({ [deviceA]: 2 });

    const missingFirst = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceC,
      webCryptoHasher,
    );
    await expect(
      missingFirst.applyRemoteMutations([outgoing[1]!]),
    ).rejects.toThrow(/expected 1/i);
    expect(await missingFirst.listEntities()).toHaveLength(0);
  });

  it("continues safely after reinstalling with the same device identity", async () => {
    const original = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    await original.commitLocalMutation(deckMutation("Vor Neuinstallation"));
    const originalJournal = await original.listMutationJournal();

    const reinstalledStorage = new MemoryLocalAuthorityStorage();
    const reinstalled = new LocalAuthorityRepository(
      reinstalledStorage,
      deviceA,
      webCryptoHasher,
    );
    await reinstalled.applyRemoteMutations(originalJournal);
    const tombstone = await reinstalled.commitLocalMutation(
      deckMutation("", {
        operation: "DELETE",
        baseVersion: 1,
        payload: null,
      }),
    );

    expect(tombstone.originSequence).toBe(2);
    expect(await reinstalled.getReplicaWatermarks()).toEqual({ [deviceA]: 2 });
    expect(await reinstalled.listEntities()).toEqual([]);

    await expect(
      original.applyRemoteMutations([originalJournal[0]!, tombstone]),
    ).resolves.toEqual({ [deviceA]: 2 });
    expect(await original.listEntities()).toEqual([]);
  });

  it("acknowledges only the outbox while retaining the mutation journal", async () => {
    const storage = new MemoryLocalAuthorityStorage();
    const repository = new LocalAuthorityRepository(
      storage,
      deviceA,
      webCryptoHasher,
    );
    const mutation = await repository.commitLocalMutation(deckMutation("Ack"));
    await repository.acknowledgeOutbox([mutation.mutationId]);

    expect(await repository.listOutbox()).toEqual([]);
    expect((await repository.exportAll()).payload.mutationJournal).toEqual([
      mutation,
    ]);
    expect(
      await new LocalAuthorityRepository(
        storage,
        deviceA,
        webCryptoHasher,
      ).listEntities(),
    ).toHaveLength(1);
  });

  it("rejects a changed payload before any remote state becomes visible", async () => {
    const source = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    const mutation = await source.commitLocalMutation(deckMutation("Valid"));
    const target = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceB,
      webCryptoHasher,
    );

    await expect(
      target.applyRemoteMutations([
        { ...mutation, payload: { title: "Manipulated" } },
      ]),
    ).rejects.toThrow(/hash mismatch/i);
    expect(await target.listEntities()).toHaveLength(0);
    expect(await target.getReplicaWatermarks()).toEqual({});
  });

  it("validates an entity payload before local or remote visibility", async () => {
    const repository = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    await expect(
      repository.commitLocalMutation(deckMutation("x".repeat(121))),
    ).rejects.toThrow(/deck payload is invalid/i);
    expect(await repository.listEntities()).toEqual([]);
    expect(await repository.listOutbox()).toEqual([]);
    await expect(
      repository.commitLocalMutation(
        deckMutation("x".repeat(8 * 1024 * 1024 + 1)),
      ),
    ).rejects.toThrow(/metadata limit/i);
    expect(await repository.listEntities()).toEqual([]);
  });

  it("uses entity-specific conflict rules and keeps deletion tombstones", async () => {
    const first = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    const second = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceB,
      webCryptoHasher,
    );
    const target = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceC,
      webCryptoHasher,
    );
    const older = await first.commitLocalMutation(deckMutation("Older"));
    const newer = await second.commitLocalMutation(
      deckMutation("Newer", { modifiedAt: "2026-08-09T16:00:00.000Z" }),
    );
    await target.applyRemoteMutations([newer, older]);
    expect((await target.listEntities())[0]?.winningMutation.payload).toEqual({
      title: "Newer",
    });

    const tombstone = await first.commitLocalMutation(
      deckMutation("", {
        operation: "DELETE",
        baseVersion: 1,
        payload: null,
        modifiedAt: "2026-08-09T17:00:00.000Z",
      }),
    );
    await target.applyRemoteMutations([tombstone]);
    expect(await target.listEntities()).toEqual([]);
    expect(
      (await target.listEntities({ includeDeleted: true }))[0]?.winningMutation
        .operation,
    ).toBe("DELETE");

    await expect(
      first.commitLocalMutation({
        entityId: reviewId,
        entityType: "REVIEW",
        operation: "DELETE",
        baseVersion: null,
        payload: null,
      }),
    ).rejects.toThrow(/append-only/i);
  });

  it("exports a hashed complete snapshot and restores it only into an empty store", async () => {
    const source = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceA,
      webCryptoHasher,
    );
    await source.commitLocalMutation(deckMutation("Backup"));
    const exported = await source.exportAll();
    expect(exported.payloadSha256).toBe(
      await hashLocalAuthorityPayload(exported.payload, webCryptoHasher),
    );

    const restored = new LocalAuthorityRepository(
      new MemoryLocalAuthorityStorage(),
      deviceB,
      webCryptoHasher,
    );
    await restored.restoreAll(exported);
    expect((await restored.listEntities())[0]?.winningMutation.payload).toEqual(
      { title: "Backup" },
    );
    expect(await restored.listOutbox()).toHaveLength(1);

    await expect(restored.restoreAll(exported)).rejects.toThrow(/empty/i);
    await expect(
      new LocalAuthorityRepository(
        new MemoryLocalAuthorityStorage(),
        deviceC,
        webCryptoHasher,
      ).restoreAll({ ...exported, payloadSha256: "0".repeat(64) }),
    ).rejects.toThrow(/hash mismatch/i);
  });

  it("hashes JSON objects independently of property insertion order", async () => {
    await expect(
      hashLocalAuthorityPayload({ b: 2, a: 1 }, webCryptoHasher),
    ).resolves.toBe(
      await hashLocalAuthorityPayload({ a: 1, b: 2 }, webCryptoHasher),
    );
    await expect(
      hashLocalAuthorityPayload({ missing: undefined }, webCryptoHasher),
    ).rejects.toThrow(/undefined/i);
  });
});
