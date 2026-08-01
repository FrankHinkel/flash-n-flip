import { createId, syncMutationSchema } from "@flashcards/domain";
import type { SyncMutation } from "@flashcards/domain";

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
