import type { PeerMutation } from "@flashcards/domain/device-sync";
import type {
  LocalMaterializedEntity,
  LocalMutationInput,
} from "@flashcards/domain/local-authority";
import {
  localCardPayloadSchema,
  localDeckPayloadSchema,
  localReviewPayloadSchema,
  localMediaReferencePayloadSchema,
  type LocalReviewPayload,
} from "@flashcards/domain/local-app-data";
import { cloudCardContent } from "./cloud-library-projection.js";
import type { LocalAuthorityByteHasher } from "./local-authority.js";

// Sort JSON keys by code point, independent of the device's UI locale.
export function hashEnginePayload(value: unknown, hasher: LocalAuthorityByteHasher): Promise<string> {
  const canonical = (item: unknown): string => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(canonical).join(",")}]`;
    if (item && typeof item === "object" && (Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null)) {
      return `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${canonical((item as Record<string,unknown>)[key])}`).join(",")}}`;
    }
    throw new Error("Invalid canonical cloud value");
  };
  return hasher(new TextEncoder().encode(canonical(value)));
}

// Portable protocol. Record identity is independent of its hash and revision.
export type EngineRecord = {
  name: string;
  lane: "progress" | "content";
  kind: "DECK" | "CARD" | "REVIEW" | "MEDIA_REFERENCE" | "PROGRESS_RESET";
  id: string;
  deckId: string;
  ancestors: string[];
  revision: string;
  hash: string;
  ownHash?: string;
  deleted: boolean;
  body: unknown;
};

const ratingOrder = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 } as const;
export function latestEngineReview(
  a: LocalReviewPayload,
  b: LocalReviewPayload,
): LocalReviewPayload {
  const time = a.reviewedAt.localeCompare(b.reviewedAt);
  if (time) return time > 0 ? a : b;
  const rating = ratingOrder[a.rating] - ratingOrder[b.rating];
  if (rating) return rating < 0 ? a : b;
  return a.reviewId.localeCompare(b.reviewId) >= 0 ? a : b;
}

export function engineAncestors(
  deckId: string,
  parents: ReadonlyMap<string, string | null>,
): string[] {
  const result: string[] = [];
  let current: string | null | undefined = deckId;
  while (current) {
    if (result.includes(current))
      throw new Error("Deck hierarchy contains a cycle");
    result.push(current);
    current = parents.get(current);
  }
  return result;
}

export async function engineRecordForMutation(
  mutation: PeerMutation,
  parents: ReadonlyMap<string, string | null>,
  hasher: LocalAuthorityByteHasher,
  previous?: EngineRecord,
): Promise<EngineRecord | null> {
  if (
    !["DECK", "CARD", "REVIEW", "MEDIA_REFERENCE"].includes(mutation.entityType)
  )
    return null;
  const kind = mutation.entityType as EngineRecord["kind"];
  const deleted = mutation.operation === "DELETE";
  let body: unknown = null;
  let deckId = previous?.deckId ?? mutation.entityId;
  if (!deleted) {
    if (kind === "DECK") body = localDeckPayloadSchema.parse(mutation.payload);
    if (kind === "CARD") {
      const card = localCardPayloadSchema.parse(mutation.payload);
      deckId = card.deckId;
      body = cloudCardContent(card);
    }
    if (kind === "REVIEW") {
      body = localReviewPayloadSchema.parse(mutation.payload);
      deckId = (body as LocalReviewPayload).deckId;
    }
    if (kind === "MEDIA_REFERENCE") {
      const media = localMediaReferencePayloadSchema.parse(mutation.payload);
      deckId = media.deckId;
      body = media;
    }
  }
  // updatedAt changes during a review. It must not change content hashes.
  const hashBody =
    kind === "DECK" && body
      ? Object.fromEntries(
          Object.entries(body).filter(([key]) => key !== "updatedAt"),
        )
      : body;
  const hash = await hashEnginePayload(
    { kind, deleted, body: hashBody },
    hasher,
  );
  if ((previous?.ownHash ?? previous?.hash) === hash) return previous!;
  return {
    name: `${kind}.${mutation.entityId}`,
    id: mutation.entityId,
    kind,
    deckId,
    ancestors:
      previous && deleted
        ? previous.ancestors
        : engineAncestors(deckId, parents),
    lane: kind === "REVIEW" ? "progress" : "content",
    deleted,
    hash,
    body,
    // A tombstone is permanent for this identity. A new import has new IDs.
    revision: `${deleted ? "z" : "a"}|${mutation.modifiedAt}|${mutation.mutationId}`,
  };
}

export async function engineDeckTreeHashes(
  records: readonly EngineRecord[],
  hasher: LocalAuthorityByteHasher,
): Promise<Map<string, string>> {
  const decks = new Map(
    records
      .filter((r) => r.kind === "DECK" && !r.deleted)
      .map((r) => [r.id, r]),
  );
  const result = new Map<string, string>();
  const visiting = new Set<string>();
  const visit = async (id: string): Promise<string> => {
    if (result.has(id)) return result.get(id)!;
    if (visiting.has(id)) throw new Error("Deck hierarchy contains a cycle");
    visiting.add(id);
    const own = decks.get(id)!;
    const children = [...decks.values()]
      .filter(
        (r) => (r.body as { parentDeckId: string | null }).parentDeckId === id,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const parts = records
      .filter(
        (r) =>
          r.deckId === id &&
          !r.deleted &&
          r.kind !== "DECK" &&
          r.kind !== "REVIEW",
      )
      .map((r) => [r.name, r.hash])
      .sort(([a], [b]) => a!.localeCompare(b!));
    const hash = await hashEnginePayload(
      {
        metadata: own.ownHash ?? own.hash,
        content: parts,
        children: await Promise.all(
          children.map(async (r) => [r.id, await visit(r.id)]),
        ),
      },
      hasher,
    );
    result.set(id, hash);
    visiting.delete(id);
    return hash;
  };
  for (const id of decks.keys()) await visit(id);
  return result;
}

export function planEngineProjection(
  records: readonly EngineRecord[],
  entities: readonly LocalMaterializedEntity[],
  suppressed: ReadonlySet<string>,
  targets?: ReadonlySet<string>,
): LocalMutationInput[] {
  const current = new Map(entities.map((e) => [e.winningMutation.entityId, e]));
  const tombstones = new Set(
    records.filter((r) => r.kind === "DECK" && r.deleted).map((r) => r.id),
  );
  const resets = new Map(
    records
      .filter((r) => r.kind === "PROGRESS_RESET")
      .map((r) => [r.deckId, String((r.body as { resetAt: string }).resetAt)]),
  );
  const parents = new Map(
    records
      .filter((r) => r.kind === "DECK" && !r.deleted)
      .map((r) => [r.id, localDeckPayloadSchema.parse(r.body).parentDeckId]),
  );
  const reviews = new Map<string, LocalReviewPayload>();
  for (const entity of entities) {
    const m = entity.winningMutation;
    if (m.entityType === "REVIEW") {
      const review = localReviewPayloadSchema.parse(m.payload);
      reviews.set(
        review.cardId,
        reviews.has(review.cardId)
          ? latestEngineReview(reviews.get(review.cardId)!, review)
          : review,
      );
    }
  }
  for (const record of records.filter(
    (r) => r.kind === "REVIEW" && !r.deleted,
  )) {
    const review = localReviewPayloadSchema.parse(record.body);
    if (record.id !== review.reviewId || record.deckId !== review.deckId)
      throw new Error("Review scope mismatch");
    reviews.set(
      review.cardId,
      reviews.has(review.cardId)
        ? latestEngineReview(reviews.get(review.cardId)!, review)
        : review,
    );
  }
  const plan = new Map<string, LocalMutationInput>();
  const put = (
    id: string,
    kind: Exclude<EngineRecord["kind"], "PROGRESS_RESET">,
    payload: unknown,
    deleted = false,
  ) => {
    const old = current.get(id);
    if (deleted && (!old || old.winningMutation.operation === "DELETE")) return;
    if (!deleted && old?.winningMutation.operation === "DELETE") return;
    if (
      !deleted &&
      JSON.stringify(old?.winningMutation.payload) === JSON.stringify(payload)
    )
      return;
    plan.set(id, {
      entityId: id,
      entityType: kind,
      operation: deleted ? "DELETE" : "UPSERT",
      baseVersion: old?.currentVersion ?? null,
      payload: deleted ? null : payload,
    });
  };
  for (const record of records) {
    if (
      record.kind === "PROGRESS_RESET" ||
      (targets && !targets.has(record.id))
    )
      continue;
    const ancestors = parents.has(record.deckId)
      ? engineAncestors(record.deckId, parents)
      : record.ancestors;
    if (ancestors.some((id) => tombstones.has(id))) {
      if (record.kind !== "REVIEW") put(record.id, record.kind, null, true);
      continue;
    }
    if (record.kind !== "REVIEW" && ancestors.some((id) => suppressed.has(id)))
      continue;
    if (record.deleted) {
      put(record.id, record.kind, null, true);
      continue;
    }
    if (record.kind === "REVIEW") {
      if (!current.has(record.id))
        put(
          record.id,
          record.kind,
          localReviewPayloadSchema.parse(record.body),
        );
    } else if (record.kind === "CARD") {
      const old = current.get(record.id);
      const candidate = reviews.get(record.id);
      const resetAt = resets.get(record.deckId);
      const review =
        candidate && (!resetAt || candidate.reviewedAt > resetAt)
          ? candidate
          : undefined;
      const body = record.body as Record<string, unknown>;
      const createdAt = resetAt ?? String(body.createdAt);
      const payload = localCardPayloadSchema.parse({
        ...body,
        updatedAt: createdAt,
        introducedAt: null,
        state: {
          due: createdAt,
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          scheduledDays: 0,
          reps: 0,
          lapses: 0,
          learningState: "NEW",
          lastReview: null,
        },
      });
      if (old?.winningMutation.operation === "UPSERT" && !resetAt) {
        const local = localCardPayloadSchema.parse(old.winningMutation.payload);
        payload.state = local.state;
        payload.introducedAt = local.introducedAt;
      }
      if (review) {
        payload.state = review.after;
        payload.introducedAt ??= review.reviewedAt;
        payload.updatedAt = review.reviewedAt;
      }
      put(record.id, record.kind, payload);
    } else if (record.kind === "DECK")
      put(record.id, record.kind, localDeckPayloadSchema.parse(record.body));
    else
      put(
        record.id,
        record.kind,
        localMediaReferencePayloadSchema.parse(record.body),
      );
  }
  // A review can arrive before/without a content change. Project it immediately.
  for (const [cardId, review] of reviews) {
    if (plan.has(cardId)) continue;
    const old = current.get(cardId);
    if (!old || old.winningMutation.operation === "DELETE") continue;
    const card = localCardPayloadSchema.parse(old.winningMutation.payload);
    if (
      resets.has(card.deckId) &&
      review.reviewedAt <= resets.get(card.deckId)!
    )
      continue;
    if (tombstones.has(card.deckId)) continue;
    put(cardId, "CARD", {
      ...card,
      state: review.after,
      introducedAt: card.introducedAt ?? review.reviewedAt,
      updatedAt: review.reviewedAt,
    });
  }
  return [...plan.values()];
}
