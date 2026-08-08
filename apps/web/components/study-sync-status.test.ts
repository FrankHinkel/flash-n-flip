import { ApiError } from "@flashcards/api-client";
import { describe, expect, it } from "vitest";

import {
  studySyncStatusAfterSuccess,
  studySyncStatusForFailures,
} from "./study-sync-status";

describe("study synchronization status", () => {
  it("clears a transient offline state after a successful empty-outbox sync", () => {
    expect(studySyncStatusAfterSuccess(0)).toBeNull();
  });

  it("keeps a precise sync problem while an orphaned review remains queued", () => {
    expect(studySyncStatusAfterSuccess(1)).toBe("problem");
  });

  it("distinguishes connectivity failures from rejected mutations", () => {
    expect(
      studySyncStatusForFailures([new ApiError("Network request failed", 0)]),
    ).toBe("offline");
    expect(
      studySyncStatusForFailures([new ApiError("Card not found", 404)]),
    ).toBe("problem");
  });

  it("does not report a fully synchronized attempt as offline", () => {
    expect(studySyncStatusForFailures([])).toBeNull();
  });
});
