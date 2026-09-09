import { describe, expect, it } from "vitest";
import { cloudReviewEventSchema } from "@flashcards/domain/cloud-library";
import type { CloudReviewEvent } from "@flashcards/domain/cloud-library";
import { localCardPayloadSchema, localDeckPayloadSchema } from "@flashcards/domain/local-app-data";
import type { LocalMaterializedEntity } from "@flashcards/domain/local-authority";
import {
  cloudCardContent, parseCloudDeckContent, planCloudDeckProjection,
  type CloudDeckProjectionInput,
} from "./cloud-library-projection";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-06T10:00:00.000Z";
const scope = { libraryId: id(1), libraryGeneration: id(2), deckId: id(3), deckGeneration: id(4), progressGeneration: id(5) };
const fresh = { due: time, stability: 0, difficulty: 0, elapsedDays: 0,
  scheduledDays: 0, reps: 0, lapses: 0, learningState: "NEW", lastReview: null };
const card = () => localCardPayloadSchema.parse({ deckId: scope.deckId,
  front: { blocks: [{ type: "text", text: "Question" }] },
  back: { blocks: [{ type: "text", text: "Answer" }] },
  position: 0, suspended: false, state: fresh, createdAt: time, updatedAt: time });
const deck = () => localDeckPayloadSchema.parse({ title: "Cloud", description: "", language: "de", createdAt: time, updatedAt: time });
const event = (n: number, reviewedAt: string): CloudReviewEvent => cloudReviewEventSchema.parse({
  ...scope, protocolVersion: 1, review: {
    reviewId: id(n), deckId: scope.deckId, cardId: id(10), reviewedAt, timezone: "Europe/Berlin",
    rating: "GOOD", schedulerVersion: "fixture-v1", parameters: [1], before: fresh,
    after: { ...fresh, reps: 1, lastReview: reviewedAt, due: "2026-09-07T12:00:00.000Z", learningState: "LEARNING" },
  },
});
const entity = (entityId: string, entityType: "CARD" | "DECK" | "REVIEW", payload: unknown): LocalMaterializedEntity => ({
  currentVersion: entityType === "REVIEW" ? null : 1,
  winningMutation: { mutationId: id(100 + Number(entityId.slice(-3))), entityId, entityType,
    operation: "UPSERT", originDeviceId: id(90), originSequence: 1, modifiedAt: "2026-09-09T12:00:00.000Z",
    baseVersion: null, resultVersion: entityType === "REVIEW" ? null : 1, payloadHash: "a".repeat(64), payload },
});
const fixture = (): CloudDeckProjectionInput => ({
  control: { ...scope, protocolVersion: 1, deleted: false }, base: null,
  remote: { deckId: scope.deckId, deck: deck(), cards: [{ cardId: id(10), content: cloudCardContent(card()) }], media: [] },
  entities: [], localReviews: [], remoteReviews: [], verifiedMedia: [],
  clock: { now: "2026-09-06T12:00:00.000Z", maximumFutureSkewMs: 300_000 },
});
const projectedCard = (input: CloudDeckProjectionInput) =>
  localCardPayloadSchema.parse(planCloudDeckProjection(input).find((m) => m.entityType === "CARD")!.payload);

describe("cloud deck content and learning projection", () => {
  it("keeps scheduler fields out of content and rejects injected progress", () => {
    const input = fixture();
    expect(cloudCardContent(card())).not.toHaveProperty("state");
    expect(cloudCardContent(card())).not.toHaveProperty("introducedAt");
    const bad = structuredClone(input.remote);
    Object.assign(bad.cards[0]!.content, { state: fresh });
    expect(() => parseCloudDeckContent(bad)).toThrow(/learning progress/);
  });

  it("installs a complete new deck with a fresh card", () => {
    const input = fixture();
    expect(planCloudDeckProjection(input).map((m) => m.entityType)).toEqual(["DECK", "CARD"]);
    expect(projectedCard(input).state).toEqual(fresh);
  });

  it("uses the actual latest review, not the content edit or upload timestamp", () => {
    const input = fixture();
    const early = event(20, time);
    const late = event(21, "2026-09-06T11:00:00.000Z");
    input.entities = [entity(id(10), "CARD", { ...card(), state: early.review.after }), entity(id(20), "REVIEW", early.review)];
    input.localReviews = [early];
    input.remoteReviews = [late, early];
    expect(projectedCard(input).state).toEqual(late.review.after);
    expect(planCloudDeckProjection(input).filter((m) => m.entityType === "REVIEW")).toHaveLength(1);
  });

  it("preserves a newer local review when an older review arrives later", () => {
    const input = fixture();
    const early = event(20, time);
    const late = event(21, "2026-09-06T11:00:00.000Z");
    input.entities = [entity(id(10), "CARD", { ...card(), state: late.review.after }), entity(id(21), "REVIEW", late.review)];
    input.localReviews = [late]; input.remoteReviews = [early];
    expect(projectedCard(input).state).toEqual(late.review.after);
  });

  it("does not count a duplicate event twice or rewrite an unchanged projection", () => {
    const input = fixture(); const review = event(20, time);
    input.remoteReviews = [review, review];
    const plan = planCloudDeckProjection(input);
    input.entities = plan.map((mutation) => entity(mutation.entityId,
      mutation.entityType as "DECK" | "CARD" | "REVIEW", mutation.payload));
    input.localReviews = [review];
    expect(planCloudDeckProjection(input)).toEqual([]);
  });

  it("merges one-sided content edits independently from review projection", () => {
    const input = fixture(); input.base = structuredClone(input.remote);
    input.entities = [entity(scope.deckId, "DECK", deck()), entity(id(10), "CARD", card())];
    input.remote.cards[0]!.content.front = { blocks: [{ type: "text", text: "Corrected" }] };
    input.remoteReviews = [event(20, time)];
    const projected = projectedCard(input);
    expect(projected.front).toEqual(input.remote.cards[0]!.content.front);
    expect(projected.state).toEqual(input.remoteReviews[0]!.review.after);
  });

  it("reports concurrent content edits instead of selecting the newest timestamp", () => {
    const input = fixture(); input.base = structuredClone(input.remote);
    const local = card(); local.front = { blocks: [{ type: "text", text: "Local edit" }] };
    input.entities = [entity(scope.deckId, "DECK", deck()), entity(id(10), "CARD", local)];
    input.remote.cards[0]!.content.front = { blocks: [{ type: "text", text: "Remote edit" }] };
    expect(() => planCloudDeckProjection(input)).toThrow(id(10));
  });

  it("rejects missing local review history and reused review identities", () => {
    const input = fixture(); const review = event(20, time);
    input.entities = [entity(id(20), "REVIEW", review.review)];
    expect(() => planCloudDeckProjection(input)).toThrow(/preserve every local review/);
    input.remoteReviews = [{ ...review, review: { ...review.review, rating: "AGAIN" } }];
    expect(() => planCloudDeckProjection(input)).toThrow(/preserve every local review/);
  });

  it("keeps virtual review history without replacing physical card progress", () => {
    const input = fixture(); const review = event(20, time);
    review.review.virtualCard = { kind: "XEFJORD_CROSS_LANGUAGE_V1", questionDeckId: scope.deckId,
      answerDeckId: id(80), matchKey: "a".repeat(64) };
    input.remoteReviews = [review];
    expect(projectedCard(input).state).toEqual(fresh);
    expect(planCloudDeckProjection(input).some((m) => m.entityId === review.review.reviewId)).toBe(true);
  });

  it("requires durable media receipts and never makes partial media visible", () => {
    const input = fixture();
    input.remote.media = [{ mediaId: id(30), reference: { deckId: scope.deckId, cardId: id(10),
      fileName: "image.png", mimeType: "image/png", byteSize: 8, sha256: "a".repeat(64), createdAt: time } }];
    expect(() => planCloudDeckProjection(input)).toThrow(/durably verified/);
    input.verifiedMedia = [{ mediaId: id(30), sha256: "a".repeat(64), byteSize: 8 }];
    expect(planCloudDeckProjection(input).some((m) => m.entityType === "MEDIA_REFERENCE")).toBe(true);
  });

  it("rejects deletions, tombstone resurrection, stale generations and future clocks", () => {
    const input = fixture(); input.base = structuredClone(input.remote);
    input.entities = [entity(scope.deckId, "DECK", deck()), entity(id(10), "CARD", card())];
    input.remote.cards = [];
    expect(() => planCloudDeckProjection(input)).toThrow(id(10));
    const deleted = fixture(); deleted.control.deleted = true;
    expect(() => planCloudDeckProjection(deleted)).toThrow(/deleted/);
    const tombstone = fixture();
    const local = entity(id(10), "CARD", null); local.winningMutation.operation = "DELETE";
    tombstone.entities = [local];
    expect(() => planCloudDeckProjection(tombstone)).toThrow(/explicit resolution/);
    const stale = fixture(); stale.remoteReviews = [{ ...event(20, time), progressGeneration: id(99) }];
    expect(() => planCloudDeckProjection(stale)).toThrow(/generation/);
    const future = fixture(); future.remoteReviews = [event(20, "2026-09-09T10:00:00.000Z")];
    expect(() => planCloudDeckProjection(future)).toThrow(/clock/);
  });
});
