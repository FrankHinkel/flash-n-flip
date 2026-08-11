import { createId } from "@flashcards/domain";
import {
  localAuthorityExportEnvelopeSchema,
  localAuthorityExportPayloadSchema,
  localAuthorityMetadataSchema,
  localAuthoritySchemaVersion,
  localMaterializedEntitySchema,
  localMutationInputSchema,
} from "@flashcards/domain/local-authority";
import type {
  LocalAuthorityExportEnvelope,
  LocalAuthorityMetadata,
  LocalMaterializedEntity,
  LocalMutationInput,
} from "@flashcards/domain/local-authority";
import {
  peerMutationSchema,
  replicaWatermarksSchema,
} from "@flashcards/domain/device-sync";
import type {
  PeerMutation,
  ReplicaWatermarks,
} from "@flashcards/domain/device-sync";

import { latestMutableMutation } from "./peer-conflicts.js";

export type LocalAuthorityTransaction = {
  getMetadata(): Promise<LocalAuthorityMetadata | null>;
  putMetadata(metadata: LocalAuthorityMetadata): Promise<void>;
  getEntity(entityId: string): Promise<LocalMaterializedEntity | null>;
  putEntity(entity: LocalMaterializedEntity): Promise<void>;
  listEntities(options?: {
    entityType?: PeerMutation["entityType"];
  }): Promise<LocalMaterializedEntity[]>;
  getMutation(mutationId: string): Promise<PeerMutation | null>;
  putMutation(mutation: PeerMutation): Promise<void>;
  listMutations(): Promise<PeerMutation[]>;
  getMaximumOriginSequence(originDeviceId: string): Promise<number>;
  putOutboxMutationId(mutationId: string): Promise<void>;
  deleteOutboxMutationId(mutationId: string): Promise<void>;
  listOutboxMutationIds(): Promise<string[]>;
  getWatermark(originDeviceId: string): Promise<number>;
  putWatermark(originDeviceId: string, sequence: number): Promise<void>;
  listWatermarks(): Promise<ReplicaWatermarks>;
};

export interface LocalAuthorityStorage {
  transaction<T>(
    mode: "readonly" | "readwrite",
    operation: (transaction: LocalAuthorityTransaction) => Promise<T>,
  ): Promise<T>;
}

export type LocalAuthorityByteHasher = (bytes: Uint8Array) => Promise<string>;

export type LocalAuthorityMutationValidator = (mutation: PeerMutation) => void;

export const maximumLocalMutationPayloadBytes = 8 * 1024 * 1024;
export const maximumLocalMutationBatchSize = 100_000;

const canonicalJson = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Local payload contains a non-finite number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("Local payload must contain plain JSON objects");
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.some(([, entry]) => entry === undefined)) {
      throw new Error("Local payload must not contain undefined values");
    }
    entries.sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new Error("Local payload is not JSON serializable");
};

export const canonicalLocalAuthorityPayloadBytes = (
  payload: unknown,
): Uint8Array => new TextEncoder().encode(canonicalJson(payload));

export const hashLocalAuthorityPayload = async (
  payload: unknown,
  hasher: LocalAuthorityByteHasher,
): Promise<string> => hasher(canonicalLocalAuthorityPayloadBytes(payload));

const hashLocalMutationPayload = (
  payload: unknown,
  hasher: LocalAuthorityByteHasher,
): Promise<string> => {
  const bytes = canonicalLocalAuthorityPayloadBytes(payload);
  if (bytes.byteLength > maximumLocalMutationPayloadBytes) {
    throw new Error("Local mutation payload exceeds the metadata limit");
  }
  return hasher(bytes);
};

const mutationMatches = (left: PeerMutation, right: PeerMutation): boolean =>
  canonicalJson(left) === canonicalJson(right);

const materializeMutation = (
  current: LocalMaterializedEntity | null,
  mutation: PeerMutation,
): LocalMaterializedEntity => {
  if (current && current.winningMutation.entityType !== mutation.entityType) {
    throw new Error("An entity ID cannot change its entity type");
  }
  if (mutation.entityType === "REVIEW") {
    if (mutation.operation !== "UPSERT" || mutation.resultVersion !== null) {
      throw new Error("Review events are append-only");
    }
    if (current && current.winningMutation.mutationId !== mutation.mutationId) {
      throw new Error("Review event identity collision");
    }
    return localMaterializedEntitySchema.parse({
      winningMutation: mutation,
      currentVersion: null,
    });
  }
  if (mutation.resultVersion === null) {
    throw new Error("Mutable entity mutation requires a result version");
  }
  const winner = current
    ? latestMutableMutation(current.winningMutation, mutation)
    : mutation;
  return localMaterializedEntitySchema.parse({
    winningMutation: winner,
    currentVersion: winner.resultVersion,
  });
};

type PreparedLocalMutation = {
  input: LocalMutationInput;
  mutationId: string;
  modifiedAt: string;
  payloadHash: string;
};

export class LocalAuthorityRepository {
  private readonly initialMetadata: LocalAuthorityMetadata;

  constructor(
    private readonly storage: LocalAuthorityStorage,
    deviceId: string,
    private readonly hasher: LocalAuthorityByteHasher,
    private readonly validateMutation: LocalAuthorityMutationValidator,
  ) {
    this.initialMetadata = localAuthorityMetadataSchema.parse({
      deviceId,
      nextOriginSequence: 1,
    });
  }

  private async metadata(
    transaction: LocalAuthorityTransaction,
  ): Promise<LocalAuthorityMetadata> {
    const stored = await transaction.getMetadata();
    if (!stored) {
      const maximumOriginSequence = await transaction.getMaximumOriginSequence(
        this.initialMetadata.deviceId,
      );
      const metadata = {
        ...this.initialMetadata,
        nextOriginSequence: maximumOriginSequence + 1,
      };
      await transaction.putMetadata(metadata);
      if (maximumOriginSequence > 0) {
        await transaction.putWatermark(
          metadata.deviceId,
          maximumOriginSequence,
        );
      }
      return metadata;
    }
    let metadata = localAuthorityMetadataSchema.parse(stored);
    if (metadata.deviceId !== this.initialMetadata.deviceId) {
      throw new Error("Local authority belongs to a different device identity");
    }
    const maximumOriginSequence = await transaction.getMaximumOriginSequence(
      metadata.deviceId,
    );
    if (metadata.nextOriginSequence <= maximumOriginSequence) {
      metadata = {
        ...metadata,
        nextOriginSequence: maximumOriginSequence + 1,
      };
      await transaction.putMetadata(metadata);
    }
    if (
      maximumOriginSequence >
      (await transaction.getWatermark(metadata.deviceId))
    ) {
      await transaction.putWatermark(metadata.deviceId, maximumOriginSequence);
    }
    return metadata;
  }

  async commitLocalMutation(input: LocalMutationInput): Promise<PeerMutation> {
    const [mutation] = await this.commitLocalMutations([input]);
    return mutation!;
  }

  async commitLocalMutations(
    candidates: readonly LocalMutationInput[],
    options: { maximumBatchSize?: number } = {},
  ): Promise<PeerMutation[]> {
    const maximumBatchSize = options.maximumBatchSize ?? 1_000;
    if (
      !Number.isSafeInteger(maximumBatchSize) ||
      maximumBatchSize < 1 ||
      maximumBatchSize > maximumLocalMutationBatchSize
    ) {
      throw new Error("Invalid local mutation batch limit");
    }
    if (candidates.length < 1 || candidates.length > maximumBatchSize) {
      throw new Error(
        `A local mutation batch must contain 1 to ${String(maximumBatchSize)} entries`,
      );
    }
    const prepared: PreparedLocalMutation[] = await Promise.all(
      candidates.map(async (candidate) => {
        const input = localMutationInputSchema.parse(candidate);
        return {
          input,
          mutationId: createId(),
          modifiedAt: input.modifiedAt ?? new Date().toISOString(),
          payloadHash: await hashLocalMutationPayload(
            input.payload,
            this.hasher,
          ),
        };
      }),
    );

    return this.storage.transaction("readwrite", async (transaction) => {
      let metadata = await this.metadata(transaction);
      const mutations: PeerMutation[] = [];
      for (const item of prepared) {
        const current = await transaction.getEntity(item.input.entityId);
        if (item.input.entityType === "REVIEW") {
          if (
            item.input.operation !== "UPSERT" ||
            item.input.baseVersion !== null
          ) {
            throw new Error("Review events are append-only");
          }
          if (current) throw new Error("Review event identity already exists");
        } else {
          const expectedBaseVersion = current?.currentVersion ?? null;
          if (item.input.baseVersion !== expectedBaseVersion) {
            throw new Error(
              `Local version conflict for ${item.input.entityId}: expected ${String(expectedBaseVersion)}`,
            );
          }
        }
        const resultVersion =
          item.input.entityType === "REVIEW"
            ? null
            : (current?.currentVersion ?? 0) + 1;
        const mutation = peerMutationSchema.parse({
          mutationId: item.mutationId,
          entityId: item.input.entityId,
          entityType: item.input.entityType,
          operation: item.input.operation,
          originDeviceId: metadata.deviceId,
          originSequence: metadata.nextOriginSequence,
          modifiedAt: item.modifiedAt,
          baseVersion: item.input.baseVersion,
          resultVersion,
          payloadHash: item.payloadHash,
          payload: item.input.payload,
        });
        this.validateMutation(mutation);
        await transaction.putEntity(materializeMutation(current, mutation));
        await transaction.putMutation(mutation);
        await transaction.putOutboxMutationId(mutation.mutationId);
        await transaction.putWatermark(
          mutation.originDeviceId,
          mutation.originSequence,
        );
        metadata = {
          ...metadata,
          nextOriginSequence: metadata.nextOriginSequence + 1,
        };
        await transaction.putMetadata(metadata);
        mutations.push(mutation);
      }
      return mutations;
    });
  }

  async applyRemoteMutations(
    candidates: readonly PeerMutation[],
  ): Promise<ReplicaWatermarks> {
    if (candidates.length > 1_000) {
      throw new Error("A remote mutation batch is limited to 1000 entries");
    }
    const mutations = candidates
      .map((candidate) => peerMutationSchema.parse(candidate))
      .sort(
        (left, right) =>
          left.originDeviceId.localeCompare(right.originDeviceId) ||
          left.originSequence - right.originSequence,
      );
    await Promise.all(
      mutations.map(async (mutation) => {
        if (
          (await hashLocalMutationPayload(mutation.payload, this.hasher)) !==
          mutation.payloadHash
        ) {
          throw new Error(`Payload hash mismatch for ${mutation.mutationId}`);
        }
      }),
    );
    mutations.forEach(this.validateMutation);

    return this.storage.transaction("readwrite", async (transaction) => {
      await this.metadata(transaction);
      for (const mutation of mutations) {
        const storedMutation = await transaction.getMutation(
          mutation.mutationId,
        );
        if (storedMutation) {
          if (!mutationMatches(storedMutation, mutation)) {
            throw new Error("Mutation identity collision");
          }
          const watermark = await transaction.getWatermark(
            mutation.originDeviceId,
          );
          if (mutation.originSequence > watermark) {
            if (mutation.originSequence !== watermark + 1) {
              throw new Error(
                `Mutation gap for ${mutation.originDeviceId}: expected ${watermark + 1}`,
              );
            }
            await transaction.putWatermark(
              mutation.originDeviceId,
              mutation.originSequence,
            );
          }
          continue;
        }
        const watermark = await transaction.getWatermark(
          mutation.originDeviceId,
        );
        if (mutation.originSequence <= watermark) {
          throw new Error("Origin sequence is already occupied");
        }
        if (mutation.originSequence !== watermark + 1) {
          throw new Error(
            `Mutation gap for ${mutation.originDeviceId}: expected ${watermark + 1}`,
          );
        }
        const current = await transaction.getEntity(mutation.entityId);
        await transaction.putEntity(materializeMutation(current, mutation));
        await transaction.putMutation(mutation);
        await transaction.putWatermark(
          mutation.originDeviceId,
          mutation.originSequence,
        );
      }
      return replicaWatermarksSchema.parse(await transaction.listWatermarks());
    });
  }

  async listEntities(
    options: {
      entityType?: PeerMutation["entityType"];
      includeDeleted?: boolean;
    } = {},
  ): Promise<LocalMaterializedEntity[]> {
    return this.storage.transaction("readonly", async (transaction) =>
      (await transaction.listEntities({ entityType: options.entityType }))
        .map((entity) => localMaterializedEntitySchema.parse(entity))
        .filter(
          (entity) =>
            (!options.entityType ||
              entity.winningMutation.entityType === options.entityType) &&
            (options.includeDeleted ||
              entity.winningMutation.operation !== "DELETE"),
        )
        .sort((left, right) =>
          left.winningMutation.entityId.localeCompare(
            right.winningMutation.entityId,
          ),
        ),
    );
  }

  async listOutbox(): Promise<PeerMutation[]> {
    return this.storage.transaction("readonly", async (transaction) => {
      const mutations: PeerMutation[] = [];
      for (const mutationId of await transaction.listOutboxMutationIds()) {
        const mutation = await transaction.getMutation(mutationId);
        if (!mutation) throw new Error("Outbox references a missing mutation");
        mutations.push(peerMutationSchema.parse(mutation));
      }
      return mutations.sort(
        (left, right) => left.originSequence - right.originSequence,
      );
    });
  }

  async listMutationJournal(): Promise<PeerMutation[]> {
    return this.storage.transaction("readonly", async (transaction) =>
      (await transaction.listMutations())
        .map((mutation) => peerMutationSchema.parse(mutation))
        .sort(
          (left, right) =>
            left.originDeviceId.localeCompare(right.originDeviceId) ||
            left.originSequence - right.originSequence,
        ),
    );
  }

  async acknowledgeOutbox(mutationIds: readonly string[]): Promise<void> {
    await this.storage.transaction("readwrite", async (transaction) => {
      for (const mutationId of new Set(mutationIds)) {
        await transaction.deleteOutboxMutationId(mutationId);
      }
    });
  }

  async getReplicaWatermarks(): Promise<ReplicaWatermarks> {
    return this.storage.transaction("readonly", async (transaction) =>
      replicaWatermarksSchema.parse(await transaction.listWatermarks()),
    );
  }

  async exportAll(): Promise<LocalAuthorityExportEnvelope> {
    const payload = await this.storage.transaction(
      "readwrite",
      async (transaction) => {
        const source = await this.metadata(transaction);
        return localAuthorityExportPayloadSchema.parse({
          schemaVersion: localAuthoritySchemaVersion,
          exportedAt: new Date().toISOString(),
          source,
          entities: (await transaction.listEntities()).sort((left, right) =>
            left.winningMutation.entityId.localeCompare(
              right.winningMutation.entityId,
            ),
          ),
          mutationJournal: (await transaction.listMutations()).sort(
            (left, right) =>
              left.originDeviceId.localeCompare(right.originDeviceId) ||
              left.originSequence - right.originSequence,
          ),
          outboxMutationIds: (await transaction.listOutboxMutationIds()).sort(),
          replicaWatermarks: await transaction.listWatermarks(),
        });
      },
    );
    return localAuthorityExportEnvelopeSchema.parse({
      format: "flash-n-flip-local-authority",
      version: 1,
      payloadSha256: await hashLocalAuthorityPayload(payload, this.hasher),
      payload,
    });
  }

  async restoreAll(candidate: unknown): Promise<void> {
    const envelope = localAuthorityExportEnvelopeSchema.parse(candidate);
    if (
      (await hashLocalAuthorityPayload(envelope.payload, this.hasher)) !==
      envelope.payloadSha256
    ) {
      throw new Error("Local authority export hash mismatch");
    }
    await Promise.all(
      envelope.payload.mutationJournal.map(async (mutation) => {
        if (
          (await hashLocalMutationPayload(mutation.payload, this.hasher)) !==
          mutation.payloadHash
        ) {
          throw new Error(
            `Export payload hash mismatch for ${mutation.mutationId}`,
          );
        }
      }),
    );
    envelope.payload.mutationJournal.forEach(this.validateMutation);
    const mutations = new Map(
      envelope.payload.mutationJournal.map((mutation) => [
        mutation.mutationId,
        mutation,
      ]),
    );
    if (mutations.size !== envelope.payload.mutationJournal.length) {
      throw new Error("Local authority export contains duplicate mutations");
    }
    for (const entity of envelope.payload.entities) {
      const mutation = mutations.get(entity.winningMutation.mutationId);
      if (!mutation || !mutationMatches(mutation, entity.winningMutation)) {
        throw new Error("Materialized entity is missing its journal mutation");
      }
    }
    for (const mutationId of envelope.payload.outboxMutationIds) {
      if (!mutations.has(mutationId)) {
        throw new Error("Export outbox references a missing mutation");
      }
    }

    await this.storage.transaction("readwrite", async (transaction) => {
      if (
        (await transaction.listEntities()).length > 0 ||
        (await transaction.listMutations()).length > 0 ||
        (await transaction.listOutboxMutationIds()).length > 0
      ) {
        throw new Error("Restore requires an empty local authority");
      }
      const sameDevice =
        envelope.payload.source.deviceId === this.initialMetadata.deviceId;
      await transaction.putMetadata({
        deviceId: this.initialMetadata.deviceId,
        nextOriginSequence: sameDevice
          ? envelope.payload.source.nextOriginSequence
          : 1,
      });
      for (const mutation of envelope.payload.mutationJournal) {
        await transaction.putMutation(mutation);
      }
      for (const entity of envelope.payload.entities) {
        await transaction.putEntity(entity);
      }
      const restoredOutboxIds = sameDevice
        ? envelope.payload.outboxMutationIds
        : envelope.payload.mutationJournal.map(
            (mutation) => mutation.mutationId,
          );
      for (const mutationId of restoredOutboxIds) {
        await transaction.putOutboxMutationId(mutationId);
      }
      for (const [originDeviceId, sequence] of Object.entries(
        envelope.payload.replicaWatermarks,
      )) {
        await transaction.putWatermark(originDeviceId, sequence);
      }
    });
  }
}
