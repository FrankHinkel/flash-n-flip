import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import {
  engineRecordForMutation,
  hashEnginePayload,
  engineDeckTreeHashes,
  planEngineProjection,
  type EngineRecord,
} from "@flashcards/sync/cloud-engine";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";
import { cloudCardContent } from "@flashcards/sync/cloud-library-projection";
import {
  localCardPayloadSchema,
  localDeckPayloadSchema,
  localMediaReferencePayloadSchema,
} from "@flashcards/domain/local-app-data";
import { webCryptoLocalAuthorityHasher } from "./local-authority-storage";
import type { LocalMediaStorage } from "./media-storage";
import { eraseNativeLearnerTestData } from "./cloud-engine-test-reset";

export type EngineStatus = {
  linked?: boolean;
  resetting?: boolean;
  enabled: boolean;
  account: boolean;
  progressPending: number;
  contentPending: number;
  mediaPending: number;
  inboxPending: number;
  suppressed: string[];
  problem: string | null;
  lastSuccess: string | null;
  development?: boolean;
};
export interface NativeEngineBridge {
  configure(input: { enabled?: boolean }): Promise<EngineStatus>;
  status(): Promise<EngineStatus>;
  enqueue(input: {
    records: Array<{
      name: string;
      lane: string;
      revision: string;
      hash: string;
      json: string;
    }>;
  }): Promise<void>;
  records(): Promise<{ records: string[] }>;
  inbox(): Promise<{ records: string[] }>;
  acknowledge(input: { hashes: Record<string, string> }): Promise<void>;
  suppress(input: { deckIds: string[]; value: boolean }): Promise<void>;
  synchronize(): Promise<void>;
  stageAsset(input: { hash: string; base64?: string }): Promise<void>;
  asset(input: { hash: string }): Promise<{ base64: string | null }>;
  beginTestReset(): Promise<void>;
  finishTestReset(): Promise<void>;
  eraseLegacyTestCloud(): Promise<{ zones: string[] }>;
  addListener(
    name: "changed",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}
export const nativeEngine =
  registerPlugin<NativeEngineBridge>("FlashNFlipSync");
export const usesNativeEngine = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
const hash = (body: unknown) =>
  hashEnginePayload(body, webCryptoLocalAuthorityHasher);
const base64 = (bytes: Uint8Array): string => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 32768)
    text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
};
const unbase64 = (text: string) =>
  Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));

export class NativeEngineReplica {
  private index = new Map<string, EngineRecord>();
  private loaded = false;
  private resetting = false;
  private localMediaIds: Set<string> | null = null;
  private contentWork: Promise<void> | null = null;
  private reviewWork: Promise<void> | null = null;
  constructor(
    readonly authority: LocalAuthorityRepository,
    readonly media: LocalMediaStorage,
    readonly bridge: NativeEngineBridge = nativeEngine,
  ) {}
  async load(): Promise<void> {
    if (this.loaded) return;
    for (const json of (await this.bridge.records()).records) {
      const r = JSON.parse(json) as EngineRecord;
      this.index.set(r.name, r);
    }
    this.loaded = true;
  }
  records(): EngineRecord[] {
    return [...this.index.values()];
  }
  private async send(records: EngineRecord[]) {
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      await this.bridge.enqueue({
        records: batch.map((r) => ({
          name: r.name,
          lane: r.lane,
          revision: r.revision,
          hash: r.hash,
          json: JSON.stringify(r),
        })),
      });
      batch.forEach((r) => this.index.set(r.name, r));
    }
  }
  flushReviews(): Promise<void> {
    if (this.resetting) return Promise.resolve();
    if (this.reviewWork) return this.reviewWork;
    this.reviewWork = (async () => {
      await this.load();
      const mutations = (await this.authority.listOutbox()).filter(
        (m) => m.entityType === "REVIEW",
      );
      const records = (
        await Promise.all(
          mutations.map((m) =>
            engineRecordForMutation(
              m,
              new Map(),
              webCryptoLocalAuthorityHasher,
              this.index.get(`REVIEW.${m.entityId}`),
            ),
          ),
        )
      ).filter((r): r is EngineRecord => !!r);
      await this.send(records);
      // The native SQLite journal now owns retries. A crash before this ack
      // only redelivers the same immutable record, which is idempotent.
      await this.authority.acknowledgeOutbox(
        mutations.map((m) => m.mutationId),
      );
    })().finally(() => {
      this.reviewWork = null;
    });
    return this.reviewWork;
  }
  flushContent(): Promise<void> {
    if (this.resetting) return Promise.resolve();
    if (this.contentWork) return this.contentWork;
    this.contentWork = (async () => {
      await this.load();
      await this.flushReviews();
      const status = await this.bridge.status();
      const suppressed = new Set(status.suppressed);
      const mutations = (await this.authority.listOutbox()).filter(
        (m) => m.entityType !== "REVIEW",
      );
      const latest = new Map(mutations.map((m) => [m.entityId, m]));
      const decks = await this.authority.listEntities({ entityType: "DECK" });
      const parents = new Map(
        decks
          .filter((e) => e.winningMutation.operation === "UPSERT")
          .map((e) => [
            e.winningMutation.entityId,
            localDeckPayloadSchema.parse(e.winningMutation.payload)
              .parentDeckId,
          ]),
      );
      const updated: EngineRecord[] = [];
      for (const m of latest.values()) {
        const previous = this.index.get(`${m.entityType}.${m.entityId}`);
        const record = await engineRecordForMutation(
          m,
          parents,
          webCryptoLocalAuthorityHasher,
          previous,
        );
        if (record && !record.ancestors.some((id) => suppressed.has(id))) {
          this.index.set(record.name, record);
          if (previous?.hash !== record.hash) updated.push(record);
        }
      }
      if (updated.length) {
        const hashes = await engineDeckTreeHashes(
          this.records(),
          webCryptoLocalAuthorityHasher,
        );
        const stamp = updated
          .map((r) => r.revision.slice(2))
          .sort()
          .at(-1)!;
        for (const [id, treeHash] of hashes) {
          const record = this.index.get(`DECK.${id}`)!;
          if (record.hash !== treeHash) {
            const changed = {
              ...record,
              ownHash: record.ownHash ?? record.hash,
              hash: treeHash,
              revision: `a|${stamp}`,
            };
            this.index.set(changed.name, changed);
            const old = updated.findIndex((r) => r.name === changed.name);
            if (old >= 0) updated[old] = changed;
            else updated.push(changed);
          }
        }
        await this.send(updated);
      }
      // Native CKAsset jobs have a separate durable queue and cannot monopolize
      // the small progress records. No cloud-side Base64/chunk records.
      for (const mutation of latest.values()) {
        const record = this.index.get(`MEDIA_REFERENCE.${mutation.entityId}`);
        if (
          mutation.entityType !== "MEDIA_REFERENCE" ||
          !record ||
          record.deleted
        )
          continue;
        const ref = localMediaReferencePayloadSchema.parse(record.body);
        const bytes = await this.media.get(record.id);
        if (!bytes) throw new Error("Local media is not yet available");
        await this.bridge.stageAsset({
          hash: ref.sha256,
          base64: base64(bytes.bytes),
        });
      }
      await this.authority.acknowledgeOutbox(
        mutations.map((m) => m.mutationId),
      );
    })()
      .catch((error) => {
        this.loaded = false;
        this.index.clear();
        throw error;
      })
      .finally(() => {
        this.contentWork = null;
      });
    return this.contentWork;
  }
  async applyInbox(force = false): Promise<void> {
    if (this.resetting || (await this.bridge.status()).resetting) return;
    await this.load();
    const inbox = (await this.bridge.inbox()).records;
    if (!force && !inbox.length) {
      await this.installMedia();
      return;
    }
    for (const json of inbox) {
      const r = JSON.parse(json) as EngineRecord;
      // Validate the same canonical hash used by the sender. Deck tree hashes
      // are checked against the complete indexed hierarchy below.
      const body =
        r.kind === "CARD" && !r.deleted
          ? cloudCardContent(
              localCardPayloadSchema.parse({
                ...(r.body as object),
                updatedAt: (r.body as { createdAt: string }).createdAt,
                state: {
                  due: (r.body as { createdAt: string }).createdAt,
                  stability: 0,
                  difficulty: 0,
                  elapsedDays: 0,
                  scheduledDays: 0,
                  reps: 0,
                  lapses: 0,
                  learningState: "NEW",
                  lastReview: null,
                },
              }),
            )
          : r.body;
      const hashBody =
        r.kind === "DECK" && body
          ? Object.fromEntries(
              Object.entries(body).filter(([k]) => k !== "updatedAt"),
            )
          : body;
      if (
        (await hash({ kind: r.kind, deleted: r.deleted, body: hashBody })) !==
        (r.ownHash ?? r.hash)
      )
        throw new Error("iCloud content hash mismatch");
      this.index.set(r.name, r);
    }
    const status = await this.bridge.status();
    const records = this.records();
    const targets = force
      ? new Set(records.map((r) => r.id))
      : new Set<string>();
    for (const json of inbox) {
      const r = JSON.parse(json) as EngineRecord;
      targets.add(r.id);
      if (r.kind === "REVIEW")
        targets.add((r.body as { cardId: string }).cardId);
      if ((r.kind === "DECK" && r.deleted) || r.kind === "PROGRESS_RESET") {
        for (const item of records)
          if (item.deckId === r.deckId || item.ancestors.includes(r.id))
            targets.add(item.id);
      }
    }
    const entities = (
      await Promise.all(
        [...targets].map((id) =>
          this.authority.getEntity(id, { includeDeleted: true }),
        ),
      )
    ).filter((e): e is NonNullable<typeof e> => !!e);
    const outbox = await this.authority.listOutbox();
    for (const mutation of outbox.filter((m) => m.entityType === "REVIEW")) {
      if (
        !entities.some((e) => e.winningMutation.entityId === mutation.entityId)
      )
        entities.push({ winningMutation: mutation, currentVersion: null });
    }
    const pendingIds = new Set(
      outbox.filter((m) => m.entityType !== "REVIEW").map((m) => m.entityId),
    );
    const plan = planEngineProjection(
      records.filter((r) => r.deleted || !pendingIds.has(r.id)),
      entities,
      new Set(status.suppressed),
      targets,
    );
    if (plan.length) {
      // Projection + local outbox are one durable transaction. On restart this
      // deterministic projection is harmless; the inbox is acked afterwards.
      const committed = await this.authority.commitLocalMutations(plan, {
        maximumBatchSize: 100_000,
      });
      await this.authority.acknowledgeOutbox(
        committed.map((m) => m.mutationId),
      );
    }
    await this.bridge.acknowledge({
      hashes: Object.fromEntries(
        inbox.map((json) => {
          const r = JSON.parse(json) as EngineRecord;
          return [r.name, r.hash];
        }),
      ),
    });
    await this.installMedia();
  }

  private async installMedia(): Promise<void> {
    this.localMediaIds ??= new Set(await this.media.listIds());
    const status = await this.bridge.status();
    let installed = false;
    for (const r of this.records().filter(
      (r) =>
        r.kind === "MEDIA_REFERENCE" &&
        !r.deleted &&
        !r.ancestors.some((id) => status.suppressed.includes(id)),
    )) {
      const ref = localMediaReferencePayloadSchema.parse(r.body);
      if (this.localMediaIds.has(r.id)) continue;
      const asset = await this.bridge.asset({ hash: ref.sha256 });
      if (asset.base64) {
        await this.media.put({
          mediaId: r.id,
          mimeType: ref.mimeType,
          sha256: ref.sha256,
          bytes: unbase64(asset.base64),
        });
        this.localMediaIds.add(r.id);
        installed = true;
      } else await this.bridge.stageAsset({ hash: ref.sha256 });
    }
    if (installed && typeof window !== "undefined")
      window.dispatchEvent(
        new CustomEvent("decks-changed", { detail: { source: "cloud-sync" } }),
      );
  }

  async remove(deckIds: string[], cloud: boolean): Promise<void> {
    await this.load();
    const records = this.records();
    const affected = records.filter((r) =>
      r.ancestors.some((id) => deckIds.includes(id)),
    );
    if (cloud) {
      const now = new Date().toISOString();
      const tombstones = await Promise.all(
        deckIds.map(async (id) => {
          const old = this.index.get(`DECK.${id}`);
          if (!old) throw new Error("Deck is not in the replicated library");
          return {
            ...old,
            deleted: true,
            body: null,
            ownHash: undefined,
            hash: await hash({ kind: "DECK", deleted: true, body: null }),
            revision: `z|${now}|${crypto.randomUUID()}`,
          };
        }),
      );
      await this.send(tombstones.map(({ ownHash: _, ...r }) => r));
      await this.applyInbox(true);
    } else {
      // Suppression is durable before eviction. Future remote changes cannot
      // cause an unwanted automatic redownload of this subtree.
      await this.bridge.suppress({ deckIds, value: true });
      const ids = affected.filter((r) => r.kind !== "REVIEW").map((r) => r.id);
      await this.authority.eraseCloudEntities(
        ids,
        [],
        await this.authority.getReplicaWatermarks(),
      );
      for (const r of affected.filter((r) => r.kind === "MEDIA_REFERENCE")) {
        await this.media.delete(r.id);
        this.localMediaIds?.delete(r.id);
      }
    }
  }
  async restore(deckIds: string[]): Promise<void> {
    await this.bridge.suppress({ deckIds, value: false });
    await this.applyInbox(true);
  }
  async resetProgress(deckIds: string[]): Promise<number> {
    await this.flushContent();
    const now = new Date().toISOString();
    const records = await Promise.all(
      deckIds.map(async (deckId) => {
        const body = { resetAt: now };
        return {
          name: `PROGRESS_RESET.${deckId}`,
          id: deckId,
          deckId,
          ancestors: [deckId],
          kind: "PROGRESS_RESET" as const,
          lane: "progress" as const,
          deleted: false,
          body,
          hash: await hash({ kind: "PROGRESS_RESET", deleted: false, body }),
          revision: `a|${now}|${crypto.randomUUID()}`,
        };
      }),
    );
    await this.send(records);
    await this.applyInbox(true);
    return this.records().filter(
      (r) => r.kind === "CARD" && !r.deleted && deckIds.includes(r.deckId),
    ).length;
  }

  async resetLegacy(): Promise<string[]> {
    this.resetting = true;
    await this.bridge.beginTestReset();
    await Promise.allSettled([this.reviewWork, this.contentWork]);
    try {
      const removed = await this.bridge.eraseLegacyTestCloud();
      if (usesNativeEngine()) await eraseNativeLearnerTestData();
      else {
        const entities = await this.authority.listEntities({
          includeDeleted: true,
        });
        await this.authority.eraseCloudEntities(
          entities.map((e) => e.winningMutation.entityId),
          [],
          await this.authority.getReplicaWatermarks(),
        );
        for (const id of await this.media.listIds())
          await this.media.delete(id);
      }
      this.index.clear();
      this.loaded = false;
      this.localMediaIds = new Set();
      await this.bridge.finishTestReset();
      return removed.zones;
    } finally {
      this.resetting = false;
    }
  }
}
