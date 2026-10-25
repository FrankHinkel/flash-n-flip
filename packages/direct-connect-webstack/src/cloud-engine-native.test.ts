import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineRecord } from "@flashcards/sync/cloud-engine";
import {
  engineDeckTreeHashes,
  latestEngineReview,
} from "@flashcards/sync/cloud-engine";
import {
  localCardPayloadSchema,
  localDeckPayloadSchema,
  type LocalReviewPayload,
} from "@flashcards/domain/local-app-data";
import {
  NativeEngineReplica,
  type NativeEngineBridge,
  type EngineStatus,
} from "./cloud-engine-native";
import { LocalAppRepository } from "./local-app";
import { createLocalMediaStorage } from "./media-storage";
import { webCryptoLocalAuthorityHasher } from "./local-authority-storage";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-10-25T10:00:00.000Z";
const deck = localDeckPayloadSchema.parse({
  title: "Sync test",
  description: "",
  language: "de",
  createdAt: time,
  updatedAt: time,
});
const card = localCardPayloadSchema.parse({
  deckId: id(1),
  front: { blocks: [{ type: "text", text: "Q" }] },
  back: { blocks: [{ type: "text", text: "A" }] },
  position: 0,
  suspended: false,
  state: {
    due: time,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    learningState: "NEW",
    lastReview: null,
  },
  createdAt: time,
  updatedAt: time,
});
class Bridge implements NativeEngineBridge {
  saved = new Map<string, EngineRecord>();
  received = new Map<string, EngineRecord>();
  suppressed: string[] = [];
  sent: EngineRecord[][] = [];
  fail = false;
  resetting = false;
  async configure() {
    return this.status();
  }
  async status(): Promise<EngineStatus> {
    return {
      enabled: !this.resetting,
      resetting: this.resetting,
      account: true,
      progressPending: 0,
      contentPending: 0,
      mediaPending: 0,
      inboxPending: this.received.size,
      suppressed: this.suppressed,
      problem: null,
      lastSuccess: null,
    };
  }
  async enqueue(input: Parameters<NativeEngineBridge["enqueue"]>[0]) {
    const rows = input.records.map((r) => JSON.parse(r.json) as EngineRecord);
    this.sent.push(rows);
    for (const r of rows) {
      const old = this.saved.get(r.name);
      if (!old || r.revision > old.revision) this.saved.set(r.name, r);
    }
    if (this.fail) throw new Error("reply lost after durable enqueue");
  }
  async records() {
    return { records: [...this.saved.values()].map((r) => JSON.stringify(r)) };
  }
  async inbox() {
    return {
      records: [...this.received.values()].map((r) => JSON.stringify(r)),
    };
  }
  async acknowledge(input: { hashes: Record<string, string> }) {
    for (const [name, hash] of Object.entries(input.hashes))
      if (this.received.get(name)?.hash === hash) this.received.delete(name);
  }
  async suppress(input: { deckIds: string[]; value: boolean }) {
    this.suppressed = input.value
      ? [...new Set([...this.suppressed, ...input.deckIds])]
      : this.suppressed.filter((id) => !input.deckIds.includes(id));
  }
  async synchronize() {}
  async stageAsset() {}
  async asset() {
    return { base64: null };
  }
  async beginTestReset() {
    this.resetting = true;
  }
  async finishTestReset() {
    this.resetting = false;
  }
  async eraseLegacyTestCloud() {
    this.saved.clear();
    this.received.clear();
    return { zones: ["FNF4Content", "FNF4Progress", "FNF4Assets"] };
  }
  async addListener() {
    return { remove: async () => {} };
  }
  deliver(from: Bridge) {
    for (const r of from.saved.values()) {
      const old = this.saved.get(r.name);
      if (!old || old.revision <= r.revision) {
        this.saved.set(r.name, structuredClone(r));
        this.received.set(r.name, structuredClone(r));
      }
    }
  }
}
class Device {
  db = new IDBFactory();
  bridge = new Bridge();
  repository = new LocalAppRepository(id(90));
  replica = this.open();
  open() {
    return new NativeEngineReplica(
      this.repository.cloudAuthority,
      createLocalMediaStorage(),
      this.bridge,
    );
  }
  run<T>(fn: () => Promise<T>) {
    vi.stubGlobal("indexedDB", this.db);
    return fn();
  }
  async seed() {
    await this.run(() =>
      this.repository.authority.commitLocalMutations([
        {
          entityId: id(1),
          entityType: "DECK",
          operation: "UPSERT",
          baseVersion: null,
          payload: deck,
        },
        {
          entityId: id(2),
          entityType: "CARD",
          operation: "UPSERT",
          baseVersion: null,
          payload: card,
        },
      ]),
    );
  }
  flush() {
    return this.run(() => this.replica.flushContent());
  }
  apply() {
    return this.run(() => this.replica.applyInbox());
  }
  review(reviewId: number, rating: "AGAIN" | "GOOD" | "EASY", at = time) {
    return this.run(() =>
      this.repository.reviewCard(id(2), rating, new Date(at), id(reviewId)),
    );
  }
  restart() {
    this.repository = new LocalAppRepository(id(90));
    this.replica = this.open();
  }
}
afterEach(() => vi.unstubAllGlobals());
describe("CKSyncEngine portable replica", () => {
  it("uploads individual cards and subdeck hashes, then prioritizes immutable reviews without changing content hashes", async () => {
    const a = new Device();
    await a.seed();
    await a.flush();
    const before = a.bridge.saved.get(`CARD.${id(2)}`)!.hash;
    const deckHash = a.bridge.saved.get(`DECK.${id(1)}`)!.hash;
    a.bridge.sent = [];
    await a.review(3, "GOOD");
    await a.flush();
    expect(a.bridge.sent[0]!.map((r) => r.kind)).toEqual(["REVIEW"]);
    expect(a.bridge.saved.get(`CARD.${id(2)}`)!.hash).toBe(before);
    expect(a.bridge.saved.get(`DECK.${id(1)}`)!.hash).toBe(deckHash);
    expect(
      a.bridge.sent.flat().filter((r) => r.kind !== "REVIEW"),
    ).toHaveLength(0);
    const tree = await engineDeckTreeHashes(
      a.replica.records(),
      webCryptoLocalAuthorityHasher,
    );
    expect(tree.get(id(1))).toBe(deckHash);
  });
  it("retries a lost enqueue receipt after restart without duplicating a review", async () => {
    const a = new Device();
    await a.seed();
    await a.flush();
    await a.review(3, "GOOD");
    a.bridge.fail = true;
    await expect(a.flush()).rejects.toThrow("reply lost");
    expect(
      await a.run(() => a.repository.authority.countOutbox()),
    ).toBeGreaterThan(0);
    a.restart();
    a.bridge.fail = false;
    await a.flush();
    expect(
      [...a.bridge.saved.values()].filter((r) => r.kind === "REVIEW"),
    ).toHaveLength(1);
    expect(await a.run(() => a.repository.authority.countOutbox())).toBe(0);
  });
  it("installs content and duplicate deliveries once, projects progress by actual review time, and survives reopen", async () => {
    const a = new Device(),
      b = new Device();
    await a.seed();
    await a.review(3, "GOOD");
    await a.flush();
    b.bridge.deliver(a.bridge);
    await b.apply();
    const first = (await b.run(() => b.repository.getCard(id(2))))!;
    expect(first.payload.state.reps).toBe(1);
    b.bridge.deliver(a.bridge);
    b.restart();
    await b.apply();
    expect(
      (
        await b.run(() =>
          b.repository.authority.listEntities({ entityType: "REVIEW" }),
        )
      ).length,
    ).toBe(1);
    expect(
      (await b.run(() => b.repository.getCard(id(2))))!.payload.state,
    ).toEqual(first.payload.state);
    await b.review(4, "AGAIN", "2026-10-25T10:01:00.000Z");
    await b.flush();
    a.bridge.deliver(b.bridge);
    await a.apply();
    expect(
      (await a.run(() => a.repository.getCard(id(2))))!.payload.state,
    ).toEqual((await b.run(() => b.repository.getCard(id(2))))!.payload.state);
  });
  it("uses the worse rating for simultaneous reviews on two offline devices", async () => {
    const a = new Device(),
      b = new Device();
    await a.seed();
    await a.flush();
    b.bridge.deliver(a.bridge);
    await b.apply();
    await a.review(3, "EASY");
    await b.review(4, "AGAIN");
    await a.flush();
    await b.flush();
    a.bridge.deliver(b.bridge);
    b.bridge.deliver(a.bridge);
    await a.apply();
    await b.apply();
    const stateA = (await a.run(() => a.repository.getCard(id(2))))!.payload
      .state;
    const stateB = (await b.run(() => b.repository.getCard(id(2))))!.payload
      .state;
    expect(stateA).toEqual(stateB);
    expect(stateA.learningState).toBe("LEARNING");
  });
  it("local-only eviction survives restart, keeps cloud/progress and can restore", async () => {
    const a = new Device();
    await a.seed();
    await a.review(3, "GOOD");
    await a.flush();
    await a.run(() => a.replica.remove([id(1)], false));
    a.restart();
    await a.apply();
    expect(await a.run(() => a.repository.listCards())).toHaveLength(0);
    expect(a.bridge.saved.get(`CARD.${id(2)}`)?.deleted).toBe(false);
    expect(
      await a.run(() =>
        a.repository.authority.listEntities({ entityType: "REVIEW" }),
      ),
    ).toHaveLength(1);
    await a.run(() => a.replica.restore([id(1)]));
    expect(
      (await a.run(() => a.repository.getCard(id(2))))!.payload.state.reps,
    ).toBe(1);
  });
  it("keeps a subtree tombstone authoritative over stale offline content", async () => {
    const a = new Device(),
      b = new Device();
    await a.seed();
    await a.flush();
    b.bridge.deliver(a.bridge);
    await b.apply();
    await a.run(() => a.replica.remove([id(1)], true));
    a.bridge.deliver(b.bridge);
    a.restart();
    await a.apply();
    expect(await a.run(() => a.repository.listDecks())).toHaveLength(0);
    expect(await a.run(() => a.repository.listCards())).toHaveLength(0);
    b.bridge.deliver(a.bridge);
    await b.apply();
    expect(await b.run(() => b.repository.listCards())).toHaveLength(0);
  });
  it("recovers a content enqueue interruption in the same process without acknowledging unsent cards", async () => {
    const a = new Device();
    await a.seed();
    a.bridge.fail = true;
    await expect(a.flush()).rejects.toThrow("reply lost");
    a.bridge.fail = false;
    await a.flush();
    expect(a.bridge.saved.has(`DECK.${id(1)}`)).toBe(true);
    expect(a.bridge.saved.has(`CARD.${id(2)}`)).toBe(true);
    expect(await a.run(() => a.repository.authority.countOutbox())).toBe(0);
  });
  it("propagates an explicit progress reset and ignores older reviews after restart", async () => {
    const a = new Device(),
      b = new Device();
    await a.seed();
    await a.review(3, "GOOD");
    await a.flush();
    b.bridge.deliver(a.bridge);
    await b.apply();
    await a.run(() => a.replica.resetProgress([id(1)]));
    expect(
      (await a.run(() => a.repository.getCard(id(2))))!.payload.state.reps,
    ).toBe(0);
    b.bridge.deliver(a.bridge);
    await b.apply();
    b.restart();
    b.bridge.deliver(a.bridge);
    await b.apply();
    expect(
      (await b.run(() => b.repository.getCard(id(2))))!.payload.state.reps,
    ).toBe(0);
  });
  it("changes both a subdeck and its ancestor hash when a card changes", async () => {
    const a = new Device();
    await a.seed();
    await a.run(() =>
      a.repository.authority.commitLocalMutations([
        {
          entityId: id(5),
          entityType: "DECK",
          operation: "UPSERT",
          baseVersion: null,
          payload: { ...deck, parentDeckId: id(1), title: "Child" },
        },
        {
          entityId: id(6),
          entityType: "CARD",
          operation: "UPSERT",
          baseVersion: null,
          payload: { ...card, deckId: id(5) },
        },
      ]),
    );
    await a.flush();
    const before = new Map(
      [...a.bridge.saved.values()].map((r) => [r.name, r.hash]),
    );
    const old = (await a.run(() => a.repository.authority.getEntity(id(6))))!;
    await a.run(() =>
      a.repository.authority.commitLocalMutation({
        entityId: id(6),
        entityType: "CARD",
        operation: "UPSERT",
        baseVersion: old.currentVersion,
        payload: {
          ...card,
          deckId: id(5),
          front: { blocks: [{ type: "text", text: "Changed" }] },
        },
      }),
    );
    await a.flush();
    for (const deckId of [id(1), id(5)])
      expect(a.bridge.saved.get(`DECK.${deckId}`)!.hash).not.toBe(
        before.get(`DECK.${deckId}`),
      );
    expect(a.bridge.saved.get(`CARD.${id(2)}`)!.hash).toBe(
      before.get(`CARD.${id(2)}`),
    );
  });
  it("does not overwrite an unsent offline review when an older cloud review arrives", async () => {
    const a = new Device(),
      b = new Device();
    await a.seed();
    await a.flush();
    b.bridge.deliver(a.bridge);
    await b.apply();
    await b.review(4, "AGAIN", "2026-10-25T10:02:00.000Z");
    const offline = (await b.run(() => b.repository.getCard(id(2))))!.payload
      .state;
    await a.review(3, "GOOD", "2026-10-25T10:01:00.000Z");
    await a.flush();
    b.bridge.deliver(a.bridge);
    await b.apply();
    expect(
      (await b.run(() => b.repository.getCard(id(2))))!.payload.state,
    ).toEqual(offline);
    expect(
      (await b.run(() => b.repository.authority.listOutbox())).some(
        (m) => m.entityId === id(4),
      ),
    ).toBe(true);
  });

  it("fully resets local entities, cloud cache and queues without restoring old content", async () => {
    const a = new Device();
    await a.seed();
    await a.review(3, "GOOD");
    await a.flush();
    a.bridge.deliver(a.bridge);
    await a.run(() => a.replica.resetLegacy());
    await a.apply();
    a.restart();
    await a.apply();
    expect(a.bridge.saved.size).toBe(0);
    expect(a.bridge.received.size).toBe(0);
    expect(await a.run(() => a.repository.listDecks())).toHaveLength(0);
    expect(await a.run(() => a.repository.listCards())).toHaveLength(0);
    expect(await a.run(() => a.repository.authority.countOutbox())).toBe(0);
    expect(
      await a.run(() =>
        a.repository.authority.listEntities({ entityType: "REVIEW" }),
      ),
    ).toHaveLength(0);
  });
});
