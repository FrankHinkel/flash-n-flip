import { describe, expect, it } from "vitest";
import { cloudReviewEventSchema } from "@flashcards/domain/cloud-library";
import type { CloudDeckControl } from "@flashcards/domain/cloud-library";
import { AtomicCloudLibrary, atomicCloudRootName, validateCloudAtomicOperations,
  type CloudAtomicStore, type CloudAtomicOperation } from "./cloud-library-atomic";
import { CloudLibraryError, publishCloudReview, cloudCardProgressRecordName,
  type CloudVersionedRecord } from "./cloud-library";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const identity = { libraryId: id(1), libraryGeneration: id(2) };
const control: CloudDeckControl = { ...identity, deckId: id(3), deckGeneration: id(4), progressGeneration: id(5), protocolVersion: 1, deleted: false };
const hash = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))),
  (byte) => byte.toString(16).padStart(2, "0")).join("");
class AtomicMemory implements CloudAtomicStore {
  records = new Map<string, CloudVersionedRecord>();
  sequence = 0;
  before: ((operations: readonly CloudAtomicOperation[]) => Promise<void>) | null = null;
  after: (() => void) | null = null;
  async read(name: string) { return structuredClone(this.records.get(name) ?? null); }
  async atomic(operations: readonly CloudAtomicOperation[]) {
    validateCloudAtomicOperations(operations);
    await this.before?.(operations);
    const next = structuredClone(this.records);
    for (const operation of operations) {
      if (operation.kind === "save") {
        if ((next.get(operation.name)?.changeTag ?? null) !== operation.expectedTag)
          throw new CloudLibraryError("WRITE_CONFLICT", "Atomic comparison failed");
        next.set(operation.name, { value: structuredClone(operation.value), changeTag: String(++this.sequence) });
      } else next.delete(operation.name);
    }
    this.records = next; this.after?.();
  }
}
async function fixture() {
  const store = new AtomicMemory(), library = new AtomicCloudLibrary(store, identity, hash);
  await library.initialize(); await library.registerDeck(control);
  return { store, library, deck: library.deckStore(control) };
}
const event = (n: number, reviewedAt: string) => {
  const before = { due: "2026-09-06T10:00:00.000Z", stability: 0, difficulty: 0, elapsedDays: 0,
    scheduledDays: 0, reps: 0, lapses: 0, learningState: "NEW", lastReview: null };
  const { deleted: _deleted, ...reviewScope } = control;
  return cloudReviewEventSchema.parse({ ...reviewScope, review: {
    reviewId: id(n), cardId: id(10), deckId: control.deckId, reviewedAt, timezone: "Europe/Berlin", rating: "GOOD",
    schedulerVersion: "fixture", parameters: [1], before,
    after: { ...before, reps: 1, lastReview: reviewedAt, learningState: "LEARNING" },
  } });
};
const drain = async (library: AtomicCloudLibrary, deckId: string, operationId: string) => {
  for (let page = 0; page < 10; page++) if (await library.continueDeletion(deckId, operationId)) return;
  throw new Error("Deletion did not converge");
};

describe("atomic private library catalog and deletion fence", () => {
  it("registers concurrent devices once and lists multiple catalog pages", async () => {
    const { library } = await fixture();
    await Promise.all([library.registerDeck(control), library.registerDeck(control)]);
    for (let n = 100; n < 165; n++) await library.registerDeck({ ...control, deckId: id(n) });
    expect(await library.listDecks()).toHaveLength(66);
  });

  it("publishes an indexed payload atomically and retries a lost successful response", async () => {
    const { store, library, deck } = await fixture();
    store.after = () => { store.after = null; throw new Error("lost response"); };
    await expect(deck.compareAndSwap("revision.first", null, { title: "Deck" })).rejects.toThrow("lost response");
    await deck.compareAndSwap("revision.first", null, { title: "Deck" });
    expect(await library.listPayloadNames(control)).toEqual(["revision.first"]);
    expect((await deck.read("revision.first"))?.value).toEqual({ title: "Deck" });
    await expect(deck.compareAndSwap("revision.first", null, { title: "Collision" })).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
  });

  it("prevents an in-flight upload from recreating a deleted deck payload", async () => {
    const { store, library, deck } = await fixture();
    store.before = async (operations) => {
      if (!operations.some((operation) => operation.name.startsWith("payload."))) return;
      store.before = null;
      await library.beginDeletion(control, id(70));
    };
    await expect(deck.compareAndSwap("asset.late", null, { bytes: "old" })).rejects.toMatchObject({ code: "STALE_GENERATION" });
    expect([...store.records.keys()].filter((name) => name.startsWith("payload."))).toEqual([]);
    await drain(library, control.deckId, id(70));
    expect(await library.listDecks()).toEqual([]);
  });

  it("physically removes bounded pages and resumes after a lost deletion response", async () => {
    const { store, library, deck } = await fixture();
    for (let n = 0; n < 66; n++) await deck.compareAndSwap(`asset.chunk.${n}`, null, { n });
    await library.beginDeletion(control, id(70));
    store.after = () => { store.after = null; throw new Error("crash after purge"); };
    await expect(library.continueDeletion(control.deckId, id(70))).rejects.toThrow("crash after purge");
    expect([...store.records.keys()].filter((name) => name.startsWith("payload."))).toHaveLength(2);
    const restarted = new AtomicCloudLibrary(store, identity, hash);
    await drain(restarted, control.deckId, id(70));
    expect([...store.records.keys()].filter((name) => name.startsWith("payload."))).toHaveLength(0);
    await expect(restarted.continueDeletion(control.deckId, id(70))).resolves.toBe(true);
    await expect(restarted.registerDeck(control)).rejects.toMatchObject({ code: "STALE_GENERATION" });
  });

  it("does not erase another deck even if both use identical logical media names", async () => {
    const { library, deck } = await fixture();
    const otherControl = { ...control, deckId: id(99) };
    await library.registerDeck(otherControl);
    const other = library.deckStore(otherControl);
    await deck.compareAndSwap("asset.same", null, { bytes: "shared" });
    await other.compareAndSwap("asset.same", null, { bytes: "shared" });
    await library.beginDeletion(control, id(70)); await drain(library, control.deckId, id(70));
    expect((await other.read("asset.same"))?.value).toEqual({ bytes: "shared" });
  });

  it("resets only progress, fences old writers and never repeats a completed reset", async () => {
    const { library, deck } = await fixture();
    await deck.compareAndSwap("asset.media", null, { bytes: "keep" });
    await deck.compareAndSwap("review.old", null, { rating: "GOOD" });
    await library.beginDeletion(control, id(70), id(71));
    await expect(deck.compareAndSwap("review.late", null, {})).rejects.toMatchObject({ code: "STALE_GENERATION" });
    await drain(library, control.deckId, id(70));
    const next = { ...control, progressGeneration: id(71) }, current = library.deckStore(next);
    expect((await current.read("asset.media"))?.value).toEqual({ bytes: "keep" });
    expect(await current.read("review.old")).toBeNull();
    await current.compareAndSwap("review.new", null, { rating: "EASY" });
    await library.beginDeletion(control, id(70), id(71));
    await drain(library, control.deckId, id(70));
    expect(await library.listPayloadNames(next)).toEqual(["asset.media", "review.new"]);
    expect((await current.read("review.new"))?.value).toEqual({ rating: "EASY" });
  });

  it("does not interpret an externally removed root as a new empty library", async () => {
    const { store, library, deck } = await fixture(); store.records.delete(atomicCloudRootName);
    await expect(library.listDecks()).rejects.toMatchObject({ code: "STALE_GENERATION" });
    await expect(deck.compareAndSwap("review.old", null, {})).rejects.toMatchObject({ code: "STALE_GENERATION" });
    expect(store.records.has(atomicCloudRootName)).toBe(false);
  });

  it("retains both review histories while the newest actual review wins", async () => {
    const { library, deck } = await fixture();
    const early = event(20, "2026-09-06T10:00:00.000Z"), late = event(21, "2026-09-06T11:00:00.000Z");
    const clock = { now: "2026-09-06T12:00:00.000Z", maximumFutureSkewMs: 300_000 };
    await publishCloudReview(deck, late, clock); await publishCloudReview(deck, early, clock);
    expect((await deck.read(cloudCardProgressRecordName(early)))?.value).toEqual(late);
    expect((await library.listPayloadNames(control)).filter((name) => name.startsWith("review."))).toHaveLength(2);
  });

  it("rejects unguarded deletes, duplicate names and oversized batches", () => {
    expect(() => validateCloudAtomicOperations([{ kind: "delete", name: "payload.a" }])).toThrow(/guard/);
    expect(() => validateCloudAtomicOperations([
      { kind: "save", name: "same", expectedTag: null, value: {} },
      { kind: "save", name: "same", expectedTag: null, value: {} },
    ])).toThrow(/duplicate/);
    expect(() => validateCloudAtomicOperations([{ kind: "save", name: "large", expectedTag: null, value: "x".repeat(210 * 1024) }])).toThrow(/large/);
  });
});
