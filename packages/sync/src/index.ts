import { createId, syncMutationSchema } from "@flashcards/domain";
import type { SyncMutation } from "@flashcards/domain";
import type {
  PeerMutation,
  ReplicaWatermarks,
} from "@flashcards/domain/device-sync";

export type SyncChange = {
  cursor: number;
  mutation: SyncMutation;
};

export interface SyncStore {
  getCursor(): Promise<number>;
  listOutbox(): Promise<SyncMutation[]>;
  enqueue(mutation: SyncMutation): Promise<void>;
  acknowledge(mutationIds: string[]): Promise<void>;
  applyRemote(changes: SyncChange[], cursor: number): Promise<void>;
}

export interface SyncTransport {
  push(mutations: SyncMutation[]): Promise<{ acknowledged: string[] }>;
  pull(cursor: number): Promise<{ cursor: number; changes: SyncChange[] }>;
}

export const createMutation = (
  input: Omit<SyncMutation, "mutationId" | "createdAt">,
): SyncMutation =>
  syncMutationSchema.parse({
    ...input,
    mutationId: createId(),
    createdAt: new Date().toISOString(),
  });

export const synchronize = async (
  store: SyncStore,
  transport: SyncTransport,
): Promise<number> => {
  const outbox = await store.listOutbox();
  if (outbox.length > 0) {
    const result = await transport.push(outbox);
    await store.acknowledge(result.acknowledged);
  }

  const cursor = await store.getCursor();
  const pulled = await transport.pull(cursor);
  await store.applyRemote(pulled.changes, pulled.cursor);
  return pulled.cursor;
};

export class MemorySyncStore implements SyncStore {
  private cursor = 0;
  private readonly outbox = new Map<string, SyncMutation>();
  readonly applied = new Map<string, SyncChange>();

  async getCursor(): Promise<number> {
    return this.cursor;
  }

  async listOutbox(): Promise<SyncMutation[]> {
    return [...this.outbox.values()];
  }

  async enqueue(mutation: SyncMutation): Promise<void> {
    this.outbox.set(mutation.mutationId, mutation);
  }

  async acknowledge(mutationIds: string[]): Promise<void> {
    mutationIds.forEach((id) => this.outbox.delete(id));
  }

  async applyRemote(changes: SyncChange[], cursor: number): Promise<void> {
    if (cursor < this.cursor) {
      throw new Error("Sync cursor cannot move backwards");
    }
    for (const change of changes) {
      this.applied.set(change.mutation.mutationId, change);
    }
    this.cursor = cursor;
  }
}

export function mergeReplicaWatermarks(
  local: ReplicaWatermarks,
  remote: ReplicaWatermarks,
): ReplicaWatermarks {
  const merged: ReplicaWatermarks = { ...local };
  for (const [deviceId, sequence] of Object.entries(remote)) {
    merged[deviceId] = Math.max(merged[deviceId] ?? 0, sequence);
  }
  return merged;
}

export function mutationsMissingFromReplica(
  mutations: readonly PeerMutation[],
  remoteWatermarks: ReplicaWatermarks,
  maximum = 500,
): PeerMutation[] {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 1000) {
    throw new Error("Peer sync batch size must be between 1 and 1000");
  }
  return mutations
    .filter(
      (mutation) =>
        mutation.originSequence >
        (remoteWatermarks[mutation.originDeviceId] ?? 0),
    )
    .sort(
      (left, right) =>
        left.originDeviceId.localeCompare(right.originDeviceId) ||
        left.originSequence - right.originSequence,
    )
    .slice(0, maximum);
}

export function advanceReplicaWatermarks(
  current: ReplicaWatermarks,
  applied: readonly PeerMutation[],
): ReplicaWatermarks {
  const next = { ...current };
  const grouped = new Map<string, number[]>();
  for (const mutation of applied) {
    const sequences = grouped.get(mutation.originDeviceId) ?? [];
    sequences.push(mutation.originSequence);
    grouped.set(mutation.originDeviceId, sequences);
  }
  for (const [deviceId, sequences] of grouped) {
    sequences.sort((left, right) => left - right);
    let watermark = next[deviceId] ?? 0;
    for (const sequence of sequences) {
      if (sequence <= watermark) continue;
      if (sequence !== watermark + 1) break;
      watermark = sequence;
    }
    next[deviceId] = watermark;
  }
  return next;
}

export function latestMutableMutation(
  left: PeerMutation,
  right: PeerMutation,
): PeerMutation {
  if (left.entityId !== right.entityId) {
    throw new Error("Cannot resolve mutations for different entities");
  }
  if (left.entityType === "REVIEW" || right.entityType === "REVIEW") {
    throw new Error("Review events are merged by identity, not overwritten");
  }
  const timestampComparison = left.modifiedAt.localeCompare(right.modifiedAt);
  if (timestampComparison !== 0) return timestampComparison > 0 ? left : right;
  return left.mutationId.localeCompare(right.mutationId) >= 0 ? left : right;
}

export function mergeReviewMutations(
  local: readonly PeerMutation[],
  remote: readonly PeerMutation[],
): PeerMutation[] {
  const merged = new Map<string, PeerMutation>();
  for (const mutation of [...local, ...remote]) {
    if (mutation.entityType !== "REVIEW") {
      throw new Error("Only review mutations can be merged as review events");
    }
    merged.set(mutation.mutationId, mutation);
  }
  return [...merged.values()].sort(
    (left, right) =>
      left.modifiedAt.localeCompare(right.modifiedAt) ||
      left.mutationId.localeCompare(right.mutationId),
  );
}
