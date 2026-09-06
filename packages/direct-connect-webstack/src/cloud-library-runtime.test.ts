import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localCardPayloadSchema, localDeckPayloadSchema } from "@flashcards/domain/local-app-data";
import { cloudReviewEventSchema } from "@flashcards/domain/cloud-library";
import type { CloudCuratedDeckActivation } from "@flashcards/domain/cloud-library";
import { AtomicCloudLibrary, type CloudAtomicOperation, type CloudAtomicStore } from "@flashcards/sync/cloud-library-atomic";
import { CloudLibraryError, publishCloudReview, type CloudVersionedRecord } from "@flashcards/sync/cloud-library";
import { LocalAppRepository } from "./local-app";
import { createLocalMediaStorage } from "./media-storage";
import { createBrowserCloudKeyValue } from "./cloud-library-storage";
import { CloudLibraryRuntime, cloudCodec, mergeCloudContents } from "./cloud-library-runtime";
import { assertPeerLibraryAllowed, readCloudPolicy, updateCloudPolicy } from "./cloud-library-policy";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const identity = {libraryId: id(1), libraryGeneration: id(2)};
const time = "2026-09-06T10:00:00.000Z";
const initialState = {due: time, stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0,
  reps: 0, lapses: 0, learningState: "NEW", lastReview: null};
const deck = localDeckPayloadSchema.parse({title: "Two devices", description: "", language: "de", createdAt: time, updatedAt: time});
const card = localCardPayloadSchema.parse({deckId: id(3), front: {blocks: [{type: "text", text: "Question"}]},
  back: {blocks: [{type: "text", text: "Answer"}]}, position: 0, suspended: false,
  state: initialState, createdAt: time, updatedAt: time});
class Cloud implements CloudAtomicStore {
  records = new Map<string, CloudVersionedRecord>();
  serial = 0;
  offline = false;
  loseNextReviewReply = false;
  async read(name: string) {
    if (this.offline) throw new Error("offline");
    return structuredClone(this.records.get(name) ?? null);
  }
  async atomic(ops: readonly CloudAtomicOperation[]) {
    if (this.offline) throw new Error("offline");
    const next = structuredClone(this.records);
    for (const op of ops) {
      if (op.kind === "delete") {next.delete(op.name); continue;}
      if ((next.get(op.name)?.changeTag ?? null) !== op.expectedTag) throw new CloudLibraryError("WRITE_CONFLICT", "conflict");
      next.set(op.name, {value: structuredClone(op.value), changeTag: String(++this.serial)});
    }
    this.records = next;
    if (this.loseNextReviewReply && ops.some((op) => op.kind === "save" && op.value &&
        typeof op.value === "object" && "review" in op.value)) {
      this.loseNextReviewReply = false; throw new Error("Lost reply after durable cloud commit");
    }
  }
}
class Device {
  db = new IDBFactory();
  repository = new LocalAppRepository(id(90));
  runtime: CloudLibraryRuntime;
  constructor(readonly library: AtomicCloudLibrary,
    readonly installCuratedDeck?: (activation: CloudCuratedDeckActivation) => Promise<void>) {
    this.runtime = this.open();
  }
  open() { return new CloudLibraryRuntime({identity, account: "account-a", environment: "development",
    library: this.library, authority: this.repository.cloudAuthority, media: createLocalMediaStorage(),
    values: createBrowserCloudKeyValue(), assertAccount: async () => {}, blockWrites: async () => {},
    installCuratedDeck: this.installCuratedDeck,
    now: () => new Date("2026-09-06T12:00:00.000Z")}); }
  async run<T>(operation: () => Promise<T>) { vi.stubGlobal("indexedDB", this.db); return operation(); }
  sync() {return this.run(() => this.runtime.synchronize());}
  async seed(deckPayload = deck, cardPayload = card) {await this.run(() => this.repository.authority.commitLocalMutations([
    {entityId: id(3), entityType: "DECK", operation: "UPSERT", baseVersion: null, payload: deckPayload},
    {entityId: id(4), entityType: "CARD", operation: "UPSERT", baseVersion: null, payload: cardPayload},
  ]));}
  review(reviewId: number, at: string, rating: "GOOD" | "HARD" = "GOOD") {
    return this.run(() => this.repository.reviewCard(id(4), rating, new Date(at), id(reviewId)));
  }
  restart() {this.repository = new LocalAppRepository(id(90)); this.runtime = this.open();}
}
async function fixture() {
  const cloud = new Cloud();
  const library = new AtomicCloudLibrary(cloud, identity, cloudCodec.hash);
  await library.initialize();
  const a = new Device(library), b = new Device(library);
  await a.seed();
  return {cloud, library, a, b};
}
afterEach(() => vi.unstubAllGlobals());

describe("complete cloud runtime with independent IndexedDB devices", () => {
  it("activates curated hierarchies parent-first and transfers reviews without deck content", async () => {
    const cloud = new Cloud();
    const library = new AtomicCloudLibrary(cloud, identity, cloudCodec.hash);
    await library.initialize();
    const parent = localDeckPayloadSchema.parse({...deck, title: "Africa", sourceTemplateKey: "geography:africa:v1",
      sourceContentSha256: "a".repeat(64), sourcePublishedAt: time});
    const child = localDeckPayloadSchema.parse({...deck, parentDeckId: id(3), title: "Ghana",
      sourceTemplateKey: "geography:ghana:v1", sourceContentSha256: "b".repeat(64), sourcePublishedAt: time});
    const childCard = localCardPayloadSchema.parse({...card, deckId: id(5)});
    const a = new Device(library, async () => {});
    await a.run(() => a.repository.authority.commitLocalMutations([
      {entityId: id(5), entityType: "DECK", operation: "UPSERT", baseVersion: null, payload: child},
      {entityId: id(4), entityType: "CARD", operation: "UPSERT", baseVersion: null, payload: childCard},
      {entityId: id(3), entityType: "DECK", operation: "UPSERT", baseVersion: null, payload: parent},
    ]));
    await a.review(20, "2026-09-06T10:10:00.000Z");
    expect((await a.sync()).every((result) => result.status === "synced")).toBe(true);

    const controls = await library.listDecks();
    expect(controls.map((control) => control.deckId)).toEqual([id(3), id(5)]);
    for (const control of controls) {
      const names = await library.listPayloadNames(control);
      expect(names).toContain("activation.v1");
      expect(names.some((name) => name.startsWith("revision.") || name.startsWith("asset."))).toBe(false);
    }
    expect((await library.listPayloadNames(controls[1]!)).some((name) =>
      name.startsWith("review.") && name.endsWith(id(20)))).toBe(true);

    const installed: string[] = [];
    let b!: Device;
    b = new Device(library, async activation => b.run(async () => {
      installed.push(activation.sourceTemplateKey);
      if (activation.deckId === id(3)) {
        await b.repository.authority.commitLocalMutation({entityId: id(3), entityType: "DECK",
          operation: "UPSERT", baseVersion: null, payload: parent});
      } else {
        await b.repository.authority.commitLocalMutations([
          {entityId: id(5), entityType: "DECK", operation: "UPSERT", baseVersion: null, payload: child},
          {entityId: id(4), entityType: "CARD", operation: "UPSERT", baseVersion: null, payload: childCard},
        ]);
      }
    }));
    expect((await b.sync()).every((result) => result.status === "synced")).toBe(true);
    expect(installed).toEqual(["geography:africa:v1", "geography:ghana:v1"]);
    await b.run(async () => {
      expect((await b.repository.listDecks()).map((entry) => [entry.id, entry.payload.parentDeckId]))
        .toEqual([[id(3), null], [id(5), id(3)]]);
      expect((await b.repository.getCard(id(4)))?.payload.state.lastReview).toBe("2026-09-06T10:10:00.000Z");
    });
  });

  it("transfers deck, card and verified media, reopens and repeats without duplicates", async () => {
    const {a, b} = await fixture();
    await a.run(() => a.repository.addMedia({id: id(8), deckId: id(3), fileName: "fixture.bin",
      mimeType: "application/octet-stream", bytes: new Uint8Array([1, 2, 3, 4])}));
    expect((await a.sync())[0]?.status).toBe("synced");
    expect((await b.sync())[0]?.status).toBe("synced");
    b.restart();
    await b.run(async () => {
      expect((await b.repository.listDecks())[0]?.payload.title).toBe(deck.title);
      expect((await b.repository.getCard(id(4)))?.payload.front).toEqual(card.front);
      expect((await b.repository.getMedia(id(8)))?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
    expect((await b.sync())[0]?.status).toBe("synced");
    expect(await b.run(() => b.repository.listCards())).toHaveLength(1);
  });
  it("latest actual review wins even when the older offline review uploads last", async () => {
    const {a, b} = await fixture();
    await a.sync(); await b.sync();
    await a.review(20, "2026-09-06T10:10:00.000Z", "HARD");
    await b.review(21, "2026-09-06T10:20:00.000Z");
    expect((await b.sync())[0]?.status).toBe("synced");
    expect((await a.sync())[0]?.status).toBe("synced");
    await b.sync();
    for (const device of [a, b]) await device.run(async () => {
      expect((await device.repository.getCard(id(4)))?.payload.state.lastReview).toBe("2026-09-06T10:20:00.000Z");
      expect(await device.repository.listReviews()).toHaveLength(2);
    });
  });
  it("keeps offline outbox and resumes a review committed before a lost reply", async () => {
    const {a, cloud} = await fixture();
    await a.sync(); await a.review(20, "2026-09-06T10:10:00.000Z");
    const pending = await a.run(() => a.repository.authority.countOutbox());
    cloud.offline = true;
    await expect(a.sync()).rejects.toThrow("offline");
    expect(await a.run(() => a.repository.authority.countOutbox())).toBe(pending);
    cloud.offline = false; cloud.loseNextReviewReply = true;
    expect((await a.sync())[0]?.status).toBe("error");
    a.restart();
    expect((await a.sync())[0]?.status).toBe("synced");
    expect(await a.run(() => a.repository.listReviews())).toHaveLength(1);
  });
  it("retains cloud progress when removing and restoring a local download", async () => {
    const {a} = await fixture();
    await a.review(20, "2026-09-06T10:10:00.000Z"); await a.sync();
    await a.run(() => a.runtime.executeCommand({deckId: id(3), operationId: id(30), kind: "remove", nextGeneration: id(31)}));
    expect(await a.run(() => a.repository.listDecks())).toHaveLength(0);
    expect(await a.run(() => a.repository.listReviews())).toHaveLength(1);
    a.restart();
    expect((await a.sync())[0]?.removed).toBe(true);
    await a.run(() => a.runtime.restoreDownload(id(3)));
    expect((await a.sync())[0]?.status).toBe("synced");
    expect((await a.run(() => a.repository.getCard(id(4))))?.payload.state.reps).toBe(1);
  });
  it("physically resets cloud reviews and discards stale offline progress before publishing", async () => {
    const {a, b, library} = await fixture();
    await a.review(20, "2026-09-06T10:10:00.000Z"); await a.sync(); await b.sync();
    const old = (await library.listDecks())[0]!;
    await b.review(21, "2026-09-06T10:20:00.000Z");
    await a.run(() => a.runtime.executeCommand({deckId: id(3), operationId: id(30), kind: "progress", nextGeneration: id(31)}));
    expect((await b.sync())[0]?.status).toBe("synced");
    expect(await b.run(() => b.repository.listReviews())).toHaveLength(0);
    expect((await b.run(() => b.repository.getCard(id(4))))?.payload.state.reps).toBe(0);
    const current = (await library.listDecks())[0]!;
    expect((await library.listPayloadNames(current)).some((name) => name.startsWith("review."))).toBe(false);
    const {deleted: _deleted, ...scope} = old;
    const event = cloudReviewEventSchema.parse({...scope, review: {reviewId: id(40), deckId: id(3), cardId: id(4),
      reviewedAt: time, timezone: "UTC", rating: "GOOD", schedulerVersion: "fixture", parameters: [1],
      before: initialState, after: {...initialState, reps: 1, lastReview: time}}});
    await expect(publishCloudReview(library.deckStore(old), event,
      {now: "2026-09-06T12:00:00.000Z", maximumFutureSkewMs: 300_000})).rejects.toMatchObject({code: "STALE_GENERATION"});
  });
  it("never repeats a completed local reset over newly recorded reviews", async () => {
    const {a} = await fixture(); await a.sync();
    const command = {deckId: id(3), operationId: id(30), kind: "progress" as const, nextGeneration: id(31)};
    await a.run(() => a.runtime.executeCommand(command));
    await a.review(22, "2026-09-06T10:30:00.000Z");
    a.restart(); await a.run(() => a.runtime.executeCommand(command));
    expect(await a.run(() => a.repository.listReviews())).toHaveLength(1);
    const second = {...command, operationId: id(32), nextGeneration: id(33)};
    await a.run(() => a.runtime.executeCommand(second));
    await a.review(23, "2026-09-06T10:40:00.000Z");
    a.restart();
    await a.run(() => a.runtime.executeCommand(command));
    await a.run(() => a.runtime.executeCommand(second));
    expect((await a.run(() => a.repository.listReviews())).map((entry) => entry.payload.reviewId)).toEqual([id(23)]);
  });
  it("deletes cloud payload and local history without stale-device resurrection", async () => {
    const {a, b, library} = await fixture(); await a.sync(); await b.sync();
    await a.run(() => a.runtime.executeCommand({deckId: id(3), operationId: id(30), kind: "deck", nextGeneration: id(31)}));
    expect((await b.sync())[0]?.status).toBe("deleted");
    expect(await b.run(() => b.repository.listDecks())).toHaveLength(0);
    expect(await library.listDecks()).toHaveLength(0);
    a.restart(); await a.sync(); expect(await library.listDecks()).toHaveLength(0);
  });
  it("requires explicit resolution for concurrent content edits", async () => {
    const {a, b} = await fixture(); await a.sync(); await b.sync();
    for (const [device, title] of [[a, "A"], [b, "B"]] as const) await device.run(async () => {
      const current = (await device.repository.listDecks())[0]!;
      await device.repository.authority.commitLocalMutation({entityId: id(3), entityType: "DECK", operation: "UPSERT",
        baseVersion: current.version, payload: {...current.payload, title}});
    });
    expect((await a.sync())[0]?.status).toBe("synced");
    expect((await b.sync())[0]?.status).toBe("conflict");
    expect((await b.run(() => b.runtime.synchronize({deckId: id(3), revisionId: "local"})))[0]?.status).toBe("synced");
    expect(() => mergeCloudContents(null,
      {deckId: id(3), deck, cards: [], media: []},
      {deckId: id(3), deck: {...deck, title: "Different"}, cards: [], media: []})).toThrow(/Concurrent cloud content/);
  });
  it("fences peers and legacy resets durably, including after pause/restart", async () => {
    const {a} = await fixture();
    await a.run(async () => {
      await updateCloudPolicy(() => ({account: "account-a", environment: "development", enabled: false, blocked: false, command: null}));
      await expect(assertPeerLibraryAllowed()).rejects.toThrow(/iCloud/);
      await expect(a.repository.resetDeckProgress(new Set([id(3)]))).rejects.toThrow(/iCloud/);
      expect((await readCloudPolicy())?.enabled).toBe(false);
      await updateCloudPolicy((policy) => ({...policy!, blocked: true}));
      await expect(a.repository.reviewCard(id(4), "GOOD", new Date(time), id(22))).rejects.toThrow(/Loeschauftrag/);
    });
  });
});
