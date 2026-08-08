import { describe, expect, it, vi } from "vitest";

import { runStudyStartupSynchronization } from "./study-startup-sync";

describe("study startup synchronization", () => {
  it("continues with progress synchronization after an orphaned review fails", async () => {
    const pullProgress = vi.fn(async () => undefined);

    await expect(
      runStudyStartupSynchronization({
        flushPendingReviews: async () => {
          throw new Error("404 Card not found");
        },
        pullProgress,
      }),
    ).resolves.toBe(false);
    expect(pullProgress).toHaveBeenCalledOnce();
  });

  it("reports a fully synchronized startup only when both operations succeed", async () => {
    await expect(
      runStudyStartupSynchronization({
        flushPendingReviews: async () => undefined,
        pullProgress: async () => undefined,
      }),
    ).resolves.toBe(true);
  });

  it("contains a progress-pull failure instead of rejecting the study load", async () => {
    await expect(
      runStudyStartupSynchronization({
        flushPendingReviews: async () => undefined,
        pullProgress: async () => {
          throw new Error("offline");
        },
      }),
    ).resolves.toBe(false);
  });
});
