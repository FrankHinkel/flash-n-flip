import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudReviewEventSchema } from "@flashcards/domain/cloud-library";
import { localCardPayloadSchema, localDeckPayloadSchema } from "@flashcards/domain/local-app-data";
import { applyCloudDeckProjection, cloudCardContent } from "@flashcards/sync/cloud-library-projection";
import { LocalAppRepository } from "./local-app";
import { webLocalAuthorityDatabaseName } from "./local-authority-storage";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-06T10:00:00.000Z";
const scope = { libraryId: id(1), libraryGeneration: id(2), deckId: id(3), deckGeneration: id(4), progressGeneration: id(5) };
const before = { due: time, stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0,
  reps: 0, lapses: 0, learningState: "NEW", lastReview: null };
const card = localCardPayloadSchema.parse({ deckId: scope.deckId,
  front: { blocks: [{ type: "text", text: "Question" }] }, back: { blocks: [{ type: "text", text: "Answer" }] },
  position: 0, suspended: false, state: before, createdAt: time, updatedAt: time });
const deck = localDeckPayloadSchema.parse({ title: "Cloud", description: "", language: "de", createdAt: time, updatedAt: time });
const review = cloudReviewEventSchema.parse({ ...scope, protocolVersion: 1,
  review: { reviewId: id(20), deckId: scope.deckId, cardId: id(10), reviewedAt: time, timezone: "Europe/Berlin",
    rating: "GOOD", schedulerVersion: "fixture-v1", parameters: [1], before,
    after: { ...before, reps: 1, lastReview: time, due: "2026-09-07T10:00:00.000Z", learningState: "LEARNING" } } });
const input = () => ({ control: { ...scope, protocolVersion: 1 as const, deleted: false }, base: null,
  remote: { deckId: scope.deckId, deck, cards: [{ cardId: id(10), content: cloudCardContent(card) }], media: [] },
  localReviews: [], remoteReviews: [review], verifiedMedia: [],
  clock: { now: "2026-09-06T12:00:00.000Z", maximumFutureSkewMs: 300_000 } });

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(webLocalAuthorityDatabaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Local database remained open"));
  });
});

describe("cloud projection through the real IndexedDB learner repository", () => {
  it("persists decks, cards and review events, reopens and ignores duplicate delivery", async () => {
    const app = new LocalAppRepository(id(90));
    const applied = await applyCloudDeckProjection(app.authority, input());
    expect(applied).toHaveLength(3);
    const restarted = new LocalAppRepository(id(90));
    expect((await restarted.listDecks())[0]?.payload.title).toBe("Cloud");
    expect((await restarted.getCard(id(10)))?.payload.state).toEqual(review.review.after);
    expect(await restarted.authority.listEntities({ entityType: "REVIEW" })).toHaveLength(1);
    expect(await restarted.authority.countOutbox()).toBe(3);
    expect(await applyCloudDeckProjection(restarted.authority, { ...input(), localReviews: [review] })).toEqual([]);
    expect(await restarted.authority.countOutbox()).toBe(3);
  });

  it("rolls back the entire cloud installation when local work races the snapshot", async () => {
    const app = new LocalAppRepository(id(90));
    const commit = app.authority.commitLocalMutations.bind(app.authority);
    vi.spyOn(app.authority, "commitLocalMutations").mockImplementationOnce(async (mutations, options) => {
      await commit([{ entityId: id(91), entityType: "DECK", operation: "UPSERT", baseVersion: null,
        payload: { ...deck, title: "Concurrent local deck" } }]);
      return commit(mutations, options);
    });
    await expect(applyCloudDeckProjection(app.authority, input())).rejects.toThrow(/replica changed/);
    const restarted = new LocalAppRepository(id(90));
    expect((await restarted.listDecks()).map((entry) => entry.payload.title)).toEqual(["Concurrent local deck"]);
    expect(await restarted.getCard(id(10))).toBeNull();
    expect(await restarted.authority.listEntities({ entityType: "REVIEW" })).toEqual([]);
    expect(await restarted.authority.countOutbox()).toBe(1);
  });
});
