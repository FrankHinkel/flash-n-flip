import { describe, expect, it } from "vitest";

import {
  cloudAssetManifestSchema,
  cloudDeckControlSchema,
  cloudReviewEventSchema,
} from "@flashcards/domain/cloud-library";
import type {
  CloudDeckControl,
  CloudDeckRevision,
  CloudReviewEvent,
} from "@flashcards/domain/cloud-library";

import {
  CloudLibraryError,
  cloudCardProgressRecordName,
  cloudDeckControlRecordName,
  cloudDeckRevisionHeads,
  cloudReviewRecordName,
  latestCloudReviewByCard,
  mergeCloudReviewEvents,
  missingCloudAssetChunks,
  publishCloudReview,
} from "./cloud-library";
import type { CloudRecordStore, CloudVersionedRecord } from "./cloud-library";

const id = (suffix: number): string =>
  `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const scope = {
  libraryId: id(1),
  libraryGeneration: id(2),
  deckId: id(3),
  deckGeneration: id(4),
  progressGeneration: id(5),
};
const control: CloudDeckControl = {
  ...scope,
  protocolVersion: 1,
  deleted: false,
};
const clock = { now: "2026-09-06T12:00:00.000Z", maximumFutureSkewMs: 300_000 };
const review = (
  eventId: number,
  reviewedAt: string,
  cardId = id(10),
): CloudReviewEvent => {
  const before = {
    due: "2026-09-06T09:00:00.000Z",
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    learningState: "NEW" as const,
    lastReview: null,
  };
  return cloudReviewEventSchema.parse({
    ...scope,
    protocolVersion: 1,
    review: {
      reviewId: id(eventId),
      cardId,
      deckId: scope.deckId,
      reviewedAt,
      timezone: "Europe/Berlin",
      rating: "GOOD",
      schedulerVersion: "fixture-v1",
      parameters: Array.from({ length: 21 }, () => 1),
      before,
      after: {
        ...before,
        reps: 1,
        lastReview: reviewedAt,
        learningState: "LEARNING",
        due: "2026-09-07T10:00:00.000Z",
      },
    },
  });
};
const early = () => review(20, "2026-09-06T10:00:00.000Z");
const late = () => review(21, "2026-09-06T10:05:00.000Z");

class FakeCloud implements CloudRecordStore {
  records = new Map<string, CloudVersionedRecord>();
  counter = 0;
  beforeWrite: ((name: string, value: unknown) => void) | null = null;
  constructor() {
    this.put(cloudDeckControlRecordName(scope), control);
  }
  put(name: string, value: unknown): void {
    this.records.set(name, {
      value: structuredClone(value),
      changeTag: String(++this.counter),
    });
  }
  async read(name: string): Promise<CloudVersionedRecord | null> {
    return structuredClone(this.records.get(name) ?? null);
  }
  async compareAndSwap(
    name: string,
    tag: string | null,
    value: unknown,
  ): Promise<void> {
    this.beforeWrite?.(name, value);
    if ((this.records.get(name)?.changeTag ?? null) !== tag) {
      throw new CloudLibraryError("WRITE_CONFLICT", "Concurrent write");
    }
    this.put(name, value);
  }
}

describe("iCloud learning contract", () => {
  it("selects the last review per card regardless of arrival order", () => {
    const other = review(22, "2026-09-06T10:10:00.000Z", id(11));
    for (const events of [
      [early(), late(), other],
      [other, late(), early()],
    ]) {
      const winners = latestCloudReviewByCard(control, events, clock);
      expect(winners.get(id(10))?.review).toEqual(late().review);
      expect(winners.get(id(11))?.review).toEqual(other.review);
    }
  });

  it("keeps both histories and counts duplicate delivery only once", () => {
    expect(
      mergeCloudReviewEvents([early(), late()], [late(), early()]),
    ).toEqual([early(), late()]);
  });

  it("uses event IDs to break identical timestamp ties deterministically", () => {
    const a = early();
    const b = review(21, a.review.reviewedAt);
    expect(latestCloudReviewByCard(control, [b, a], clock).get(id(10))).toEqual(
      b,
    );
  });

  it("compares instants rather than ISO fractional-second spelling", () => {
    const a = review(22, "2026-09-06T10:00:00Z");
    const b = review(21, "2026-09-06T10:00:00.100Z");
    expect(latestCloudReviewByCard(control, [a, b], clock).get(id(10))).toEqual(
      b,
    );
  });

  it("rejects an event ID reused with another card or rating", () => {
    expect(() =>
      mergeCloudReviewEvents(
        [early()],
        [review(20, early().review.reviewedAt, id(11))],
      ),
    ).toThrow(/identity/i);
    const changed = early();
    changed.review.rating = "AGAIN";
    expect(() => mergeCloudReviewEvents([early()], [changed])).toThrow(
      /identity/i,
    );
  });

  it("does not use events from an old library, deck or progress generation", () => {
    for (const key of [
      "libraryGeneration",
      "deckGeneration",
      "progressGeneration",
    ] as const) {
      const stale = late();
      stale[key] = id(99);
      expect(
        latestCloudReviewByCard(control, [early(), stale], clock).get(id(10)),
      ).toEqual(early());
    }
    expect(
      latestCloudReviewByCard({ ...control, deleted: true }, [late()], clock)
        .size,
    ).toBe(0);
  });

  it("reports future clocks without modifying or dropping the source event", () => {
    const future = review(23, "2026-09-09T10:00:00.000Z");
    const snapshot = structuredClone(future);
    expect(() =>
      latestCloudReviewByCard(control, [early(), future], clock),
    ).toThrow(/clock/i);
    expect(future).toEqual(snapshot);
  });

  it("rejects reviews whose saved after-state belongs to another timestamp", () => {
    const invalid = early();
    invalid.review.after.lastReview = late().review.reviewedAt;
    expect(cloudReviewEventSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects mismatched deck IDs and unknown protocol versions", () => {
    const invalid = early();
    invalid.review.deckId = id(99);
    expect(cloudReviewEventSchema.safeParse(invalid).success).toBe(false);
    expect(
      cloudReviewEventSchema.safeParse({ ...early(), protocolVersion: 2 })
        .success,
    ).toBe(false);
    expect(
      cloudDeckControlSchema.safeParse({ ...control, deleted: undefined })
        .success,
    ).toBe(false);
  });
});

describe("conditional cloud review publication", () => {
  it("converges with reverse delivery and never recomputes the scheduler state", async () => {
    for (const events of [
      [early(), late()],
      [late(), early()],
    ]) {
      const cloud = new FakeCloud();
      for (const event of events) await publishCloudReview(cloud, event, clock);
      expect(
        (await cloud.read(cloudCardProgressRecordName(early())))?.value,
      ).toEqual(late());
      expect(await cloud.read(cloudReviewRecordName(early()))).not.toBeNull();
      expect(await cloud.read(cloudReviewRecordName(late()))).not.toBeNull();
    }
  });

  it("publishes duplicate events idempotently without additional writes", async () => {
    const cloud = new FakeCloud();
    await publishCloudReview(cloud, early(), clock);
    const writes = cloud.counter;
    await publishCloudReview(cloud, early(), clock);
    expect(cloud.counter).toBe(writes);
  });

  it("repairs an interrupted event/projection publication on restart", async () => {
    const cloud = new FakeCloud();
    cloud.beforeWrite = (name) => {
      if (name.startsWith("progress."))
        throw new Error("connection interrupted");
    };
    await expect(publishCloudReview(cloud, early(), clock)).rejects.toThrow(
      "interrupted",
    );
    expect(await cloud.read(cloudReviewRecordName(early()))).not.toBeNull();
    expect(await cloud.read(cloudCardProgressRecordName(early()))).toBeNull();
    cloud.beforeWrite = null;
    await publishCloudReview(cloud, early(), clock);
    expect(
      (await cloud.read(cloudCardProgressRecordName(early())))?.value,
    ).toEqual(early());
  });

  it("re-reads and preserves a newer concurrent projection after a CAS conflict", async () => {
    const cloud = new FakeCloud();
    cloud.beforeWrite = (name) => {
      if (!name.startsWith("progress.")) return;
      cloud.beforeWrite = null;
      cloud.put(name, late());
    };
    await publishCloudReview(cloud, early(), clock);
    expect(
      (await cloud.read(cloudCardProgressRecordName(early())))?.value,
    ).toEqual(late());
  });

  it("keeps a permanent conflict retryable instead of forcing an overwrite", async () => {
    const cloud = new FakeCloud();
    let attempts = 0;
    cloud.beforeWrite = (name) => {
      if (name.startsWith("progress.")) {
        attempts++;
        throw new CloudLibraryError("WRITE_CONFLICT", "busy");
      }
    };
    await expect(publishCloudReview(cloud, early(), clock)).rejects.toThrow(
      /keep the local outbox/i,
    );
    expect(attempts).toBe(8);
    expect(await cloud.read(cloudReviewRecordName(early()))).not.toBeNull();
  });

  it("refuses missing or deleted controls without uploading anything", async () => {
    for (const deleted of [false, true]) {
      const cloud = new FakeCloud();
      if (deleted)
        cloud.put(cloudDeckControlRecordName(scope), {
          ...control,
          deleted: true,
        });
      else cloud.records.clear();
      await expect(
        publishCloudReview(cloud, early(), clock),
      ).rejects.toBeInstanceOf(CloudLibraryError);
      expect(await cloud.read(cloudReviewRecordName(early()))).toBeNull();
    }
  });

  it("does not confirm old progress if a reset happens while publishing", async () => {
    const cloud = new FakeCloud();
    cloud.beforeWrite = (name) => {
      if (name.startsWith("progress."))
        cloud.put(cloudDeckControlRecordName(scope), {
          ...control,
          progressGeneration: id(99),
        });
    };
    await expect(publishCloudReview(cloud, early(), clock)).rejects.toThrow(
      /deleted or replaced/,
    );
    const next = { ...late(), progressGeneration: id(99) };
    expect(await cloud.read(cloudCardProgressRecordName(next))).toBeNull();
  });

  it("rejects a cloud progress record mapped to the wrong card", async () => {
    const cloud = new FakeCloud();
    cloud.put(
      cloudCardProgressRecordName(early()),
      review(22, late().review.reviewedAt, id(11)),
    );
    await expect(publishCloudReview(cloud, early(), clock)).rejects.toThrow(
      /different card/,
    );
  });

  it("rejects a cloud event stored under the wrong event ID", async () => {
    const cloud = new FakeCloud();
    cloud.put(cloudReviewRecordName(early()), late());
    await expect(publishCloudReview(cloud, early(), clock)).rejects.toThrow(
      /identity/i,
    );
  });
});

const asset = {
  sha256: "a".repeat(64),
  byteSize: 6,
  chunks: [
    { index: 0, sha256: "b".repeat(64), byteSize: 3 },
    { index: 1, sha256: "c".repeat(64), byteSize: 3 },
  ],
};
const revision = (
  revisionId: number,
  parents: number[] = [],
): CloudDeckRevision => ({
  protocolVersion: 1,
  libraryId: scope.libraryId,
  libraryGeneration: scope.libraryGeneration,
  deckId: scope.deckId,
  deckGeneration: scope.deckGeneration,
  revisionId: id(revisionId),
  parentRevisionIds: parents.map(id),
  content: structuredClone(asset),
});

describe("deck revisions and resumable media manifests", () => {
  it("retains both concurrent edits until a revision explicitly merges them", () => {
    const revisions = [revision(30), revision(31, [30]), revision(32, [30])];
    expect(cloudDeckRevisionHeads(revisions)).toEqual([
      revision(31, [30]),
      revision(32, [30]),
    ]);
    expect(
      cloudDeckRevisionHeads([...revisions, revision(33, [31, 32])]),
    ).toEqual([revision(33, [31, 32])]);
  });

  it("rejects missing or cyclic ancestry instead of exposing an incomplete deck", () => {
    expect(() => cloudDeckRevisionHeads([revision(31, [30])])).toThrow(
      /not been received/,
    );
    expect(() =>
      cloudDeckRevisionHeads([revision(30, [31]), revision(31, [30])]),
    ).toThrow(/cyclic/);
  });

  it("rejects conflicting revision IDs and cross-deck merges", () => {
    const changed = revision(30);
    changed.content.sha256 = "d".repeat(64);
    expect(() => cloudDeckRevisionHeads([revision(30), changed])).toThrow(
      /identity/i,
    );
    expect(() =>
      cloudDeckRevisionHeads([
        revision(30),
        { ...revision(31), deckId: id(99) },
      ]),
    ).toThrow(/Mixed/);
  });

  it("resumes from verified chunk receipts without trusting partial data", () => {
    expect(missingCloudAssetChunks(asset, [])).toEqual([0, 1]);
    expect(
      missingCloudAssetChunks(asset, [asset.chunks[0]!, asset.chunks[0]!]),
    ).toEqual([1]);
    expect(missingCloudAssetChunks(asset, asset.chunks)).toEqual([]);
    expect(() =>
      missingCloudAssetChunks(asset, [
        { ...asset.chunks[0]!, sha256: "d".repeat(64) },
      ]),
    ).toThrow(/receipt/);
  });

  it("rejects noncontiguous chunks and incorrect aggregate sizes", () => {
    expect(
      cloudAssetManifestSchema.safeParse({ ...asset, byteSize: 7 }).success,
    ).toBe(false);
    expect(
      cloudAssetManifestSchema.safeParse({
        ...asset,
        chunks: [...asset.chunks].reverse(),
      }).success,
    ).toBe(false);
  });
});
