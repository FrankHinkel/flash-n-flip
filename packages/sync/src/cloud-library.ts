import {
  cloudAssetManifestSchema,
  cloudDeckControlSchema,
  cloudDeckRevisionSchema,
  cloudProgressScopeSchema,
  cloudReviewEventSchema,
} from "@flashcards/domain/cloud-library";
import type {
  CloudAssetManifest,
  CloudDeckControl,
  CloudDeckRevision,
  CloudProgressScope,
  CloudReviewEvent,
} from "@flashcards/domain/cloud-library";

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export class CloudLibraryError extends Error {
  constructor(
    readonly code:
      | "IDENTITY_COLLISION"
      | "STALE_GENERATION"
      | "CLOCK_CONFLICT"
      | "WRITE_CONFLICT"
      | "ACCOUNT_CHANGED"
      | "INVALID_REMOTE_RECORD"
      | "INCOMPLETE_REVISION",
    message: string,
  ) {
    super(message);
    this.name = "CloudLibraryError";
  }
}

export function cloudScopeKey(input: CloudProgressScope): string {
  const scope = cloudProgressScopeSchema.parse({
    libraryId: input.libraryId,
    libraryGeneration: input.libraryGeneration,
    deckId: input.deckId,
    deckGeneration: input.deckGeneration,
    progressGeneration: input.progressGeneration,
  });
  return [
    scope.libraryId,
    scope.libraryGeneration,
    scope.deckId,
    scope.deckGeneration,
    scope.progressGeneration,
  ].join(".");
}

export function assertCloudProgressScope(
  control: CloudDeckControl,
  event: CloudReviewEvent,
): void {
  const parsed = cloudDeckControlSchema.parse(control);
  if (parsed.deleted || cloudScopeKey(parsed) !== cloudScopeKey(event)) {
    throw new CloudLibraryError(
      "STALE_GENERATION",
      "The deck or progress was deleted or replaced",
    );
  }
}

// Both winning and superseded events survive. Event identity is global inside
// this input, so an ID reused for another card cannot silently replace it.
export function mergeCloudReviewEvents(
  ...replicas: readonly (readonly CloudReviewEvent[])[]
): CloudReviewEvent[] {
  const events = new Map<string, CloudReviewEvent>();
  for (const candidate of replicas.flat()) {
    const event = cloudReviewEventSchema.parse(candidate);
    const key = event.review.reviewId;
    const previous = events.get(key);
    if (previous && canonical(previous) !== canonical(event)) {
      throw new CloudLibraryError(
        "IDENTITY_COLLISION",
        "Review identity has different contents",
      );
    }
    events.set(key, event);
  }
  return [...events.values()].sort((a, b) => {
    const time =
      Date.parse(a.review.reviewedAt) - Date.parse(b.review.reviewedAt);
    return (
      time ||
      (a.review.reviewId < b.review.reviewId
        ? -1
        : a.review.reviewId > b.review.reviewId
          ? 1
          : 0)
    );
  });
}

export type CloudReviewClock = { now: string; maximumFutureSkewMs: number };

export function latestCloudReviewByCard(
  control: CloudDeckControl,
  candidates: readonly CloudReviewEvent[],
  clock: CloudReviewClock,
): Map<string, CloudReviewEvent> {
  cloudDeckControlSchema.parse(control);
  const now = Date.parse(clock.now);
  if (
    !Number.isFinite(now) ||
    !Number.isSafeInteger(clock.maximumFutureSkewMs) ||
    clock.maximumFutureSkewMs < 0
  ) {
    throw new Error("Invalid review clock");
  }
  const latest = new Map<string, CloudReviewEvent>();
  for (const event of mergeCloudReviewEvents(candidates)) {
    // Stale data is not admitted into the current projection. Callers retain
    // its local outbox until the remote deletion has been durably applied.
    if (control.deleted || cloudScopeKey(control) !== cloudScopeKey(event))
      continue;
    if (Date.parse(event.review.reviewedAt) > now + clock.maximumFutureSkewMs) {
      throw new CloudLibraryError(
        "CLOCK_CONFLICT",
        "Review time is ahead of the accepted device clock",
      );
    }
    latest.set(event.review.cardId, event);
  }
  return latest;
}

export function missingCloudAssetChunks(
  candidate: CloudAssetManifest,
  verifiedChunks: readonly {
    index: number;
    sha256: string;
    byteSize: number;
  }[],
): number[] {
  const manifest = cloudAssetManifestSchema.parse(candidate);
  const present = new Map<number, { sha256: string; byteSize: number }>();
  for (const receipt of verifiedChunks) {
    const expected = manifest.chunks[receipt.index];
    if (
      !expected ||
      receipt.sha256 !== expected.sha256 ||
      receipt.byteSize !== expected.byteSize
    ) {
      throw new CloudLibraryError(
        "INVALID_REMOTE_RECORD",
        "Chunk receipt does not match the manifest",
      );
    }
    present.set(receipt.index, receipt);
  }
  return manifest.chunks
    .filter((chunk) => !present.has(chunk.index))
    .map((chunk) => chunk.index);
}

// Concurrent content edits remain separate heads until an explicit revision
// references all parents. Neither timestamps nor learning progress pick one.
export function cloudDeckRevisionHeads(
  candidates: readonly CloudDeckRevision[],
): CloudDeckRevision[] {
  const revisions = new Map<string, CloudDeckRevision>();
  let scope: string | null = null;
  for (const candidate of candidates) {
    const revision = cloudDeckRevisionSchema.parse(candidate);
    const key = [
      revision.libraryId,
      revision.libraryGeneration,
      revision.deckId,
      revision.deckGeneration,
    ].join(".");
    if (scope !== null && scope !== key)
      throw new CloudLibraryError(
        "STALE_GENERATION",
        "Mixed deck revision scopes",
      );
    scope = key;
    const previous = revisions.get(revision.revisionId);
    if (previous && canonical(previous) !== canonical(revision)) {
      throw new CloudLibraryError(
        "IDENTITY_COLLISION",
        "Revision identity has different contents",
      );
    }
    revisions.set(revision.revisionId, revision);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const parents = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id))
      throw new CloudLibraryError(
        "INVALID_REMOTE_RECORD",
        "Revision ancestry is cyclic",
      );
    if (visited.has(id)) return;
    const revision = revisions.get(id);
    if (!revision)
      throw new CloudLibraryError(
        "INCOMPLETE_REVISION",
        "A parent revision has not been received",
      );
    visiting.add(id);
    for (const parent of revision.parentRevisionIds) {
      parents.add(parent);
      visit(parent);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of revisions.keys()) visit(id);
  return [...revisions.values()]
    .filter((revision) => !parents.has(revision.revisionId))
    .sort((a, b) =>
      a.revisionId < b.revisionId ? -1 : a.revisionId > b.revisionId ? 1 : 0,
    );
}

export type CloudVersionedRecord = { value: unknown; changeTag: string };

// The owning platform adapter must pin every request to one account/session.
// null expectedTag means create-only, never an unconditional upsert.
export interface CloudRecordStore {
  read(recordName: string): Promise<CloudVersionedRecord | null>;
  compareAndSwap(
    recordName: string,
    expectedTag: string | null,
    value: unknown,
  ): Promise<void>;
}

export const cloudDeckControlRecordName = (scope: CloudProgressScope): string =>
  `deck.${scope.libraryId}.${scope.libraryGeneration}.${scope.deckId}`;

export const cloudReviewRecordName = (event: CloudReviewEvent): string =>
  `review.${event.libraryId}.${event.libraryGeneration}.${event.review.reviewId}`;

export const cloudCardProgressRecordName = (event: CloudReviewEvent): string =>
  `progress.${cloudScopeKey(event)}.${event.review.cardId}`;

const isConflict = (error: unknown): boolean =>
  error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT";

// Idempotent publication: durable local outbox -> immutable event -> derived
// card projection -> local acknowledgement. Failure at any point is retried
// with the same event. Nothing here deletes or acknowledges local data.
export async function publishCloudReview(
  store: CloudRecordStore,
  candidate: CloudReviewEvent,
  clock: CloudReviewClock,
): Promise<void> {
  const event = cloudReviewEventSchema.parse(candidate);
  const readControl = async (): Promise<CloudDeckControl> => {
    const record = await store.read(cloudDeckControlRecordName(event));
    if (!record)
      throw new CloudLibraryError(
        "STALE_GENERATION",
        "Cloud deck control is missing",
      );
    const control = cloudDeckControlSchema.parse(record.value);
    assertCloudProgressScope(control, event);
    latestCloudReviewByCard(control, [event], clock);
    return control;
  };
  await readControl();
  const eventName = cloudReviewRecordName(event);
  const assertSameEvent = (value: unknown): void => {
    if (canonical(cloudReviewEventSchema.parse(value)) !== canonical(event)) {
      throw new CloudLibraryError(
        "IDENTITY_COLLISION",
        "Cloud review identity has different contents",
      );
    }
  };
  const existing = await store.read(eventName);
  if (existing) {
    assertSameEvent(existing.value);
  } else {
    try {
      await store.compareAndSwap(eventName, null, event);
    } catch (error) {
      if (!isConflict(error)) throw error;
      const raced = await store.read(eventName);
      if (!raced) throw error;
      assertSameEvent(raced.value);
    }
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const control = await readControl();
    const name = cloudCardProgressRecordName(event);
    const previous = await store.read(name);
    const current = previous
      ? cloudReviewEventSchema.parse(previous.value)
      : null;
    if (
      current &&
      (cloudScopeKey(current) !== cloudScopeKey(event) ||
        current.review.cardId !== event.review.cardId)
    ) {
      throw new CloudLibraryError(
        "INVALID_REMOTE_RECORD",
        "Progress record belongs to a different card or generation",
      );
    }
    const winner = latestCloudReviewByCard(
      control,
      current ? [current, event] : [event],
      clock,
    ).get(event.review.cardId)!;
    if (!current || canonical(current) !== canonical(winner)) {
      try {
        await store.compareAndSwap(name, previous?.changeTag ?? null, winner);
      } catch (error) {
        if (isConflict(error)) continue;
        throw error;
      }
    }
    // A reset concurrent with a projection write invalidates the old namespace.
    // Do not tell the caller to acknowledge it as current progress.
    await readControl();
    return;
  }
  throw new CloudLibraryError(
    "WRITE_CONFLICT",
    "Cloud progress remains busy; keep the local outbox entry",
  );
}
