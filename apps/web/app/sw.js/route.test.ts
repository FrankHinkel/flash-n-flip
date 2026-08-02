import { describe, expect, it } from "vitest";

import { createUpdateServiceWorkerSource, GET } from "./route";

describe("update-only service worker", () => {
  it("changes its source with the application build identity", () => {
    expect(createUpdateServiceWorkerSource("build-one")).not.toBe(
      createUpdateServiceWorkerSource("build-two"),
    );
  });

  it("waits for explicit activation and never intercepts content requests", () => {
    const source = createUpdateServiceWorkerSource("release-123");

    expect(source).toContain('event.data?.type === "SKIP_WAITING"');
    expect(source).toContain("self.skipWaiting()");
    expect(source).not.toContain('addEventListener("fetch"');
    expect(source).not.toContain("caches.open");
  });

  it("is served from the application root without caching", () => {
    const response = GET();

    expect(response.headers.get("cache-control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
