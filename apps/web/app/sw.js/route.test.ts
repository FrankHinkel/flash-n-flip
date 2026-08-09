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
    expect(source).toContain('"/pwa"');
    expect(source).not.toContain('"/password-reset"');
    expect(source).toContain(
      'new Set(["/brand/flash-and-flip.svg","/connect/app.js","/connect/styles.css","/curated/catalog.v2.json"])',
    );
    expect(source).toContain('"/connect/index.html"');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).not.toContain('const SHELL_ROUTES = ["/",');
  });

  it("precaches the bottom navigation app mark for flight mode", async () => {
    const listeners = new Map<string, (event: never) => void>();
    const requestedUrls: string[] = [];
    const cachedKeys: unknown[] = [];
    const cache = {
      match: async () => undefined,
      put: async (key: unknown) => {
        cachedKeys.push(key);
      },
    };
    const worker = {
      addEventListener: (type: string, listener: (event: never) => void) =>
        listeners.set(type, listener),
      clients: { claim: async () => undefined },
      location: { origin: "https://flash-n-flip.test" },
      skipWaiting: () => undefined,
    };
    new Function(
      "self",
      "caches",
      "fetch",
      "Request",
      "Response",
      createServiceWorkerSource("offline-brand-mark"),
    )(
      worker,
      { open: async () => cache },
      async (request: Request) => {
        requestedUrls.push(request.url);
        return new Response("asset", { status: 200 });
      },
      Request,
      Response,
    );

    let installPromise: Promise<unknown> | undefined;
    listeners.get("install")?.({
      waitUntil: (promise: Promise<unknown>) => {
        installPromise = promise;
      },
    } as never);
    await installPromise;

    expect(requestedUrls).toContain(
      "https://flash-n-flip.test/brand/flash-and-flip.svg",
    );
    expect(cachedKeys).toContain("/brand/flash-and-flip.svg");
  });

  it("does not cache redirected documents and returns a fresh redirect", async () => {
    const listeners = new Map<string, (event: never) => void>();
    const storedResponses: unknown[] = [];
    const cache = {
      match: async () => undefined,
      put: async (...values: unknown[]) => {
        storedResponses.push(values);
      },
    };
    const redirected = {
      headers: new Headers(),
      ok: true,
      redirected: true,
      type: "basic",
      url: "https://flash-n-flip.test/login",
      clone: () => redirected,
    };
    const worker = {
      addEventListener: (type: string, listener: (event: never) => void) =>
        listeners.set(type, listener),
      clients: { claim: async () => undefined },
      location: { origin: "https://flash-n-flip.test" },
      skipWaiting: () => undefined,
    };
    const caches = {
      delete: async () => true,
      keys: async () => [],
      match: async () => undefined,
      open: async () => cache,
    };
    new Function(
      "self",
      "caches",
      "fetch",
      "Request",
      "Response",
      createServiceWorkerSource("redirect-safe"),
    )(worker, caches, async () => redirected, Request, Response);

    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://flash-n-flip.test/app",
      },
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    } as never);

    const response = await responsePromise;
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(
      "https://flash-n-flip.test/login",
    );
    expect(storedResponses).toEqual([]);
  });

  it("moves legacy root launches to the redirect-safe offline app start", async () => {
    const listeners = new Map<string, (event: never) => void>();
    const worker = {
      addEventListener: (type: string, listener: (event: never) => void) =>
        listeners.set(type, listener),
      clients: { claim: async () => undefined },
      location: { origin: "https://flash-n-flip.test" },
      skipWaiting: () => undefined,
    };
    new Function(
      "self",
      "caches",
      "fetch",
      "Request",
      "Response",
      createServiceWorkerSource("root-pass-through"),
    )(worker, {}, async () => Response.error(), Request, Response);

    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://flash-n-flip.test/",
      },
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    } as never);

    const response = await responsePromise;
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(
      "https://flash-n-flip.test/pwa",
    );
  });

  it("serves the cached app document after a cold offline launch", async () => {
    const listeners = new Map<string, (event: never) => void>();
    const cachedApp = new Response("<main>Offline app</main>", {
      headers: { "content-type": "text/html" },
    });
    const cache = {
      match: async (key: unknown) => (key === "/app" ? cachedApp : undefined),
      put: async () => undefined,
    };
    const worker = {
      addEventListener: (type: string, listener: (event: never) => void) =>
        listeners.set(type, listener),
      clients: { claim: async () => undefined },
      location: { origin: "https://flash-n-flip.test" },
      skipWaiting: () => undefined,
    };
    new Function(
      "self",
      "caches",
      "fetch",
      "Request",
      "Response",
      createServiceWorkerSource("offline-cold-start"),
    )(
      worker,
      {
        open: async () => cache,
      },
      async () => {
        throw new TypeError("offline");
      },
      Request,
      Response,
    );

    let responsePromise: Promise<Response> | undefined;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "navigate",
        url: "https://flash-n-flip.test/app",
      },
      respondWith: (response: Promise<Response>) => {
        responsePromise = response;
      },
    } as never);

    expect(await responsePromise).toBe(cachedApp);
  });

  it("keeps API and authenticated media responses out of the HTTP cache", () => {
    const source = createServiceWorkerSource("release-123");

    expect(source).toContain('url.pathname.startsWith("/_next/static/")');
    expect(source).toContain("SHELL_ASSETS.has(url.pathname)");
    expect(source).toContain('!url.pathname.startsWith("/api/")');
    expect(source).not.toContain("/media/");
    expect(source).toContain('!response.headers.has("set-cookie")');
    expect(source).toContain("!response.redirected");
  });

  it("does not intercept API requests while a peer webstack is active", () => {
    const listeners = new Map<string, (event: never) => void>();
    const worker = {
      addEventListener: (type: string, listener: (event: never) => void) =>
        listeners.set(type, listener),
      clients: { claim: async () => undefined },
      location: { origin: "https://flash-n-flip.test" },
      skipWaiting: () => undefined,
    };
    new Function(
      "self",
      "caches",
      "fetch",
      "Request",
      "Response",
      createServiceWorkerSource("api-pass-through"),
    )(worker, {}, async () => Response.error(), Request, Response);

    let intercepted = false;
    listeners.get("fetch")?.({
      request: {
        method: "GET",
        mode: "cors",
        url: "https://flash-n-flip.test/api/decks",
      },
      respondWith: () => {
        intercepted = true;
      },
    } as never);

    expect(intercepted).toBe(false);
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
