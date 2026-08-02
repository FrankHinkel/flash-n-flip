import { describe, expect, it } from "vitest";

import { formatAppBuildTime } from "./app-build";

describe("application build metadata", () => {
  it("formats the build instant with date and time in the requested zone", () => {
    expect(
      formatAppBuildTime("2026-08-02T21:47:08.000Z", "de-DE", "Europe/Berlin"),
    ).toBe("02.08.2026, 23:47:08");
  });

  it("does not render an invalid build instant", () => {
    expect(formatAppBuildTime("invalid", "de-DE")).toBeNull();
  });
});
