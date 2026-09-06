import type { CardState } from "@flashcards/domain";
import {
  cloudDeckControlSchema,
  type CloudDeckControl,
  type CloudReviewEvent,
} from "@flashcards/domain/cloud-library";
import {
  localCardPayloadSchema,
  localDeckPayloadSchema,
  localMediaReferencePayloadSchema,
  localReviewPayloadSchema,
  type LocalCardPayload,
  type LocalDeckPayload,
  type LocalMediaReferencePayload,
} from "@flashcards/domain/local-app-data";
import type { LocalMaterializedEntity, LocalMutationInput } from "@flashcards/domain/local-authority";
import {
  CloudLibraryError,
  cloudScopeKey,
  latestCloudReviewByCard,
  mergeCloudReviewEvents,
  type CloudReviewClock,
} from "./cloud-library.js";
import {
  canonicalLocalAuthorityPayloadBytes, maximumLocalMutationBatchSize,
  type LocalAuthorityRepository,
} from "./local-authority.js";

export type CloudCardContent = Omit<LocalCardPayload, "state" | "introducedAt" | "updatedAt">;
export type CloudDeckContent = {
  deckId: string;
  deck: LocalDeckPayload;
  cards: { cardId: string; content: CloudCardContent }[];
  media: { mediaId: string; reference: LocalMediaReferencePayload }[];
};

const same = (a: unknown, b: unknown): boolean => {
  const left = canonicalLocalAuthorityPayloadBytes(a);
  const right = canonicalLocalAuthorityPayloadBytes(b);
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
};

const initialState = (createdAt: string): CardState => ({
  due: createdAt, stability: 0, difficulty: 0, elapsedDays: 0,
  scheduledDays: 0, reps: 0, lapses: 0, learningState: "NEW", lastReview: null,
});

// Content revisions cannot transport a scheduler state, even accidentally.
export function cloudCardContent(payload: LocalCardPayload): CloudCardContent {
  const { state: _state, introducedAt: _introduced, updatedAt: _updated, ...content } =
    localCardPayloadSchema.parse(payload);
  return content;
}

export function parseCloudDeckContent(value: CloudDeckContent): CloudDeckContent {
  if (!value || !Array.isArray(value.cards) || !Array.isArray(value.media))
    throw new Error("Invalid cloud deck content");
  if (value.cards.length + value.media.length > 99_999)
    throw new Error("Cloud deck exceeds the atomic installation limit");
  const deck = localDeckPayloadSchema.parse(value.deck);
  const ids = new Set([value.deckId]);
  const uniqueId = (id: string): void => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || ids.has(id))
      throw new Error("Invalid or duplicate cloud entity identity");
    ids.add(id);
  };
  // Validate the deck ID using the same UUID constraint as card ownership.
  localMediaReferencePayloadSchema.shape.deckId.parse(value.deckId);
  const cards = value.cards.map(({ cardId, content }) => {
    uniqueId(cardId);
    if (!content || "state" in content || "introducedAt" in content || "updatedAt" in content)
      throw new Error("Cloud content must not contain learning progress");
    const card = localCardPayloadSchema.parse({
      ...content, state: initialState(content.createdAt),
      introducedAt: null, updatedAt: content.createdAt,
    });
    if (card.deckId !== value.deckId) throw new Error("Cloud card belongs to another deck");
    return { cardId, content: cloudCardContent(card) };
  });
  const media = value.media.map(({ mediaId, reference }) => {
    uniqueId(mediaId);
    const parsed = localMediaReferencePayloadSchema.parse(reference);
    if (parsed.deckId !== value.deckId) throw new Error("Cloud media belongs to another deck");
    return { mediaId, reference: parsed };
  });
  return { deckId: value.deckId, deck, cards, media };
}

export class CloudContentConflict extends Error {
  constructor(readonly entityId: string) {
    super(`Concurrent cloud content requires an explicit resolution: ${entityId}`);
    this.name = "CloudContentConflict";
  }
}

// Three-way merge is per entity, never last-upload-wins. The base is the last
// content revision durably installed on this device, not the latest cloud head.
function mergeContent<T>(id: string, local: T | null, base: T | null, remote: T): T {
  if (same(local, remote) || same(local, base)) return remote;
  if (same(remote, base) && local !== null) return local;
  throw new CloudContentConflict(id);
}

export type CloudDeckProjectionInput = {
  control: CloudDeckControl;
  base: CloudDeckContent | null;
  remote: CloudDeckContent;
  entities: readonly LocalMaterializedEntity[];
  localReviews: readonly CloudReviewEvent[];
  remoteReviews: readonly CloudReviewEvent[];
  verifiedMedia: readonly { mediaId: string; sha256: string; byteSize: number }[];
  clock: CloudReviewClock;
};

// Pure planning only. The caller must commit this entire plan with the exact
// replica-watermark snapshot used to read entities. Media must be installed
// durably first. This function neither acknowledges an outbox nor advances a
// cloud cursor; those require a separate confirmed publication receipt.
export function planCloudDeckProjection(input: CloudDeckProjectionInput): LocalMutationInput[] {
  const control = cloudDeckControlSchema.parse(input.control);
  if (control.deleted) throw new CloudLibraryError("STALE_GENERATION", "Cloud deck was deleted");
  const remote = parseCloudDeckContent(input.remote);
  const base = input.base ? parseCloudDeckContent(input.base) : null;
  if (remote.deckId !== control.deckId || (base && base.deckId !== control.deckId))
    throw new Error("Cloud content scope mismatch");
  const current = new Map<string, LocalMaterializedEntity>();
  for (const entity of input.entities) {
    const id = entity.winningMutation.entityId;
    if (current.has(id)) throw new Error("Duplicate local entity");
    current.set(id, entity);
  }
  const existing = (id: string, type: LocalMutationInput["entityType"]): LocalMaterializedEntity | null => {
    const entity = current.get(id) ?? null;
    if (entity && (entity.winningMutation.entityType !== type || entity.winningMutation.operation === "DELETE"))
      throw new CloudContentConflict(id); // Do not resurrect a local tombstone.
    return entity;
  };
  const mutations: LocalMutationInput[] = [];
  const upsert = (id: string, type: LocalMutationInput["entityType"], payload: unknown): void => {
    const entity = existing(id, type);
    if (entity && same(entity.winningMutation.payload, payload)) return;
    mutations.push({ entityId: id, entityType: type, operation: "UPSERT",
      baseVersion: entity?.currentVersion ?? null, payload });
  };

  const events = mergeCloudReviewEvents(input.localReviews, input.remoteReviews);
  for (const event of events) {
    if (cloudScopeKey(event) !== cloudScopeKey(control))
      throw new CloudLibraryError("STALE_GENERATION", "Mixed progress generations require explicit reset handling");
  }
  // Validate clocks for virtual events as well, but never project a virtual
  // answer-state onto a physical card with a coincidentally identical ID.
  latestCloudReviewByCard(control, events, input.clock);
  const physical = events.filter((event) => !event.review.virtualCard);
  const winners = latestCloudReviewByCard(control, physical, input.clock);
  const reviewById = new Map(events.map((event) => [event.review.reviewId, event.review]));
  for (const entity of current.values()) {
    if (entity.winningMutation.entityType !== "REVIEW") continue;
    const review = localReviewPayloadSchema.parse(entity.winningMutation.payload);
    if (review.deckId !== control.deckId) continue;
    const retained = reviewById.get(review.reviewId);
    if (!retained || !same(review, retained))
      throw new Error("Cloud projection must preserve every local review event");
  }
  for (const { review } of events) {
    const entity = existing(review.reviewId, "REVIEW");
    if (entity && !same(entity.winningMutation.payload, review))
      throw new CloudLibraryError("IDENTITY_COLLISION", "Review identity has different contents");
    if (!entity) upsert(review.reviewId, "REVIEW", review);
  }

  const localDeck = existing(remote.deckId, "DECK");
  upsert(remote.deckId, "DECK", mergeContent(remote.deckId,
    localDeck ? localDeckPayloadSchema.parse(localDeck.winningMutation.payload) : null,
    base?.deck ?? null, remote.deck));
  const remoteCardIds = new Set(remote.cards.map((card) => card.cardId));
  // Content removal is not permission to erase learning history. Deletions
  // travel through the separately confirmed generation/deletion workflow.
  for (const card of base?.cards ?? []) {
    if (!remoteCardIds.has(card.cardId)) throw new CloudContentConflict(card.cardId);
  }
  const baseCards = new Map(base?.cards.map((card) => [card.cardId, card.content]) ?? []);
  for (const { cardId, content } of remote.cards) {
    const entity = existing(cardId, "CARD");
    const local = entity ? localCardPayloadSchema.parse(entity.winningMutation.payload) : null;
    const merged = mergeContent(cardId, local ? cloudCardContent(local) : null,
      baseCards.get(cardId) ?? null, content);
    const winner = winners.get(cardId)?.review;
    if (local?.state.lastReview && (!winner ||
        Date.parse(local.state.lastReview) > Date.parse(winner.reviewedAt)))
      throw new Error("Local learning state is newer than the supplied review history");
    if (local && local.state.reps > 0 && !winner)
      throw new Error("Learned card has no retained review history");
    const first = physical.find((event) => event.review.cardId === cardId)?.review.reviewedAt ?? null;
    const introducedAt = local?.introducedAt && first
      ? Date.parse(local.introducedAt) < Date.parse(first) ? local.introducedAt : first
      : first ?? local?.introducedAt ?? null;
    upsert(cardId, "CARD", localCardPayloadSchema.parse({ ...merged,
      state: winner?.after ?? local?.state ?? initialState(merged.createdAt),
      introducedAt, updatedAt: local?.updatedAt ?? merged.createdAt,
    }));
  }
  const receipts = new Map(input.verifiedMedia.map((receipt) => [receipt.mediaId, receipt]));
  const baseMedia = new Map(base?.media.map((media) => [media.mediaId, media.reference]) ?? []);
  for (const { mediaId, reference } of remote.media) {
    const entity = existing(mediaId, "MEDIA_REFERENCE");
    const merged = mergeContent(mediaId,
      entity ? localMediaReferencePayloadSchema.parse(entity.winningMutation.payload) : null,
      baseMedia.get(mediaId) ?? null, reference);
    const receipt = receipts.get(mediaId);
    if (!receipt || receipt.sha256 !== merged.sha256 || receipt.byteSize !== merged.byteSize)
      throw new Error("Cloud media has not been durably verified");
    upsert(mediaId, "MEDIA_REFERENCE", merged);
  }
  return mutations;
}

// Connect the pure merge to the authoritative local store. exportAll reads
// entities and watermarks in one transaction. A local review or peer delivery
// between that snapshot and commit rejects the entire application. The caller
// must retry with freshly scoped review history; never reuse an old plan.
// The returned mutations remain in the durable outbox. This is NOT a cloud
// acknowledgement and does not activate a second replication authority.
export async function applyCloudDeckProjection(
  authority: LocalAuthorityRepository,
  input: Omit<CloudDeckProjectionInput, "entities">,
) {
  const snapshot = await authority.exportAll();
  const mutations = planCloudDeckProjection({ ...input, entities: snapshot.payload.entities });
  if (mutations.length === 0) return [];
  return authority.commitLocalMutations(mutations, {
    maximumBatchSize: maximumLocalMutationBatchSize,
    expectedReplicaWatermarks: snapshot.payload.replicaWatermarks,
  });
}
