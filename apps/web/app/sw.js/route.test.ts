import { describe, expect, it } from "vitest";

import { createServiceWorkerSource, GET } from "./route";

describe("offline application service worker", () => {
  it("changes its source with the application build identity", () => {
    expect(createServiceWorkerSource("build-one")).not.toBe(
      createServiceWorkerSource("build-two"),
    );
  });

  it("emits syntactically valid worker JavaScript", () => {
    expect(
      () => new Function(createServiceWorkerSource("release-123")),
    ).not.toThrow();
  });

  it("precaches the app shell but still waits for explicit activation", () => {
    const source = createServiceWorkerSource("release-123");

    expect(source).toContain('event.data?.type === "SKIP_WAITING"');
    expect(source).toContain("self.skipWaiting()");
    expect(source).toContain('addEventListener("fetch"');
    expect(source).toContain("caches.open(SHELL_CACHE)");
    expect(source).toContain('"/app/learn"');
    expect(source).toContain('"/login"');
    expect(source).toContain('request.mode === "navigate"');
  });

  it("keeps API and authenticated media responses out of the HTTP cache", () => {
    const source = createServiceWorkerSource("release-123");

    expect(source).toContain('url.pathname.startsWith("/_next/static/")');
    expect(source).not.toContain('url.pathname.startsWith("/api/")');
    expect(source).not.toContain("/media/");
    expect(source).toContain('!response.headers.has("set-cookie")');
  });

  it("is served from the application root without caching", () => {
    const response = GET();

    expect(response.headers.get("cache-control")).toBe(
      "no-cache, no-store, must-revalidate",
    );
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain(
      "connect-src 'self'",
    );
  });
});
