import { describe, expect, it } from "vitest";

import {
  appleCloudFeatureEnabled,
  isAppleCloudRuntime,
} from "./apple-cloud-backup";

describe("Apple cloud build gate", () => {
  it("keeps CloudKit disabled in the Personal Team build", () => {
    expect(appleCloudFeatureEnabled).toBe(false);
    expect(isAppleCloudRuntime()).toBe(false);
  });
});
