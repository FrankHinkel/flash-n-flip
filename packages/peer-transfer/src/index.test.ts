import { describe, expect, it } from "vitest";

import {
  chunkByteRange,
  chunkCount,
  IncrementalSha256,
  maximumTransferBytes,
  missingChunkIndexes,
  nextTransferState,
  transferProgress,
} from "./index";

describe("peer transfer protocol", () => {
  it("caps a direct deck transfer at the import limit", () => {
    expect(maximumTransferBytes).toBe(256 * 1024 * 1024);
  });

  it("rejects invalid state transitions", () => {
    expect(nextTransferState("PREPARING", "PREPARED")).toBe(
      "AWAITING_ACCEPTANCE",
    );
    expect(() => nextTransferState("COMPLETED", "RESUME")).toThrow(
      /invalid transfer transition/i,
    );
  });

  it("plans bounded chunks without an extra empty chunk", () => {
    expect(chunkCount(0, 256)).toBe(0);
    expect(chunkCount(513, 256)).toBe(3);
    expect(chunkByteRange(513, 256, 2)).toEqual({ start: 512, end: 513 });
  });

  it("requests only missing chunks after a restart", () => {
    expect(missingChunkIndexes(5, new Set([0, 2, 4]))).toEqual([1, 3]);
  });

  it("reports exact byte and object progress", () => {
    const progress = transferProgress({
      manifest: {
        version: 1,
        transferId: "019d00de-e1f0-7528-b67d-804033433572",
        kind: "DECK_COPY",
        senderDeviceId: "019d00de-e1f0-7528-b67d-804033433568",
        rootDeckIds: ["019d00de-e1f0-7528-b67d-804033433573"],
        deckCount: 1,
        cardCount: 4,
        noteCount: 4,
        mediaCount: 1,
        totalBytes: 100,
        chunkSize: 256 * 1024,
        includesLearningProgress: false,
        manifestPayloadHash: "b".repeat(64),
        media: [],
        createdAt: new Date().toISOString(),
      },
      verifiedBytes: 50,
      verifiedObjects: 5,
    });
    expect(progress.bytePercent).toBe(50);
    expect(progress.objectPercent).toBe(50);
    expect(progress.complete).toBe(false);
  });

  it("hashes arbitrarily split byte streams as SHA-256", () => {
    const hash = new IncrementalSha256();
    hash.update(new TextEncoder().encode("a"));
    hash.update(new TextEncoder().encode("bc"));
    expect(hash.digestHex()).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
