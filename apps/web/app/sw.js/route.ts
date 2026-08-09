const buildId = process.env.NEXT_PUBLIC_FNF_WEB_BUILD_ID || "development";

export const dynamic = "force-static";

const shellRoutes = [
  "/connect/index.html",
  "/app",
  "/app/decks",
  "/app/help",
  "/app/learn",
  "/app/settings",
  "/login",
  "/password-change",
  "/password-reset",
];
const shellAssets = [
  "/brand/flash-and-flip.svg",
  "/connect/app.js",
  "/connect/styles.css",
];

export const createServiceWorkerSource = (version: string): string => `
const BUILD_ID = ${JSON.stringify(version)};
const CACHE_PREFIX = "flash-n-flip-shell-";
const SHELL_CACHE = CACHE_PREFIX + BUILD_ID;
const SHELL_ROUTES = ${JSON.stringify(shellRoutes)};
const SHELL_ASSETS = new Set(${JSON.stringify(shellAssets)});
const PUBLIC_SHELL_ROUTES = new Set(["/connect", "/connect/", "/connect/index.html", "/login", "/password-change", "/password-reset"]);

const isSameOrigin = (url) => url.origin === self.location.origin;
const isApplicationRoute = (url) =>
  isSameOrigin(url) &&
  (PUBLIC_SHELL_ROUTES.has(url.pathname) || url.pathname.startsWith("/app"));
const isStaticAsset = (url) =>
  isSameOrigin(url) &&
  (url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/connect/") ||
    url.pathname.startsWith("/icons/") ||
    SHELL_ASSETS.has(url.pathname) ||
    url.pathname === "/manifest.webmanifest");
const cacheable = (response) =>
  response.ok &&
  !response.redirected &&
  response.type !== "opaque" &&
  !response.headers.has("set-cookie");

const safeNavigationResponse = (response) => {
  if (!response.redirected) return response;
  const destination = new URL(response.url);
  return isSameOrigin(destination)
    ? Response.redirect(destination.href, 302)
    : Response.error();
};

async function storeShellDocument(cache, route) {
  const request = new Request(new URL(route, self.location.origin), {
    cache: "reload",
    credentials: "same-origin",
  });
  const response = await fetch(request);
  if (!cacheable(response)) return;
  await cache.put(route, response.clone());
  if (!(response.headers.get("content-type") || "").includes("text/html")) return;

  const html = await response.text();
  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const url = new URL(match[1], self.location.origin);
    if (isStaticAsset(url)) assets.add(url.href);
  }
  await Promise.allSettled(
    [...assets].map(async (asset) => {
      const assetResponse = await fetch(
        new Request(asset, { cache: "reload", credentials: "same-origin" }),
      );
      if (cacheable(assetResponse)) await cache.put(asset, assetResponse);
    }),
  );
}

async function storeShellAsset(cache, route) {
  const request = new Request(new URL(route, self.location.origin), {
    cache: "reload",
    credentials: "same-origin",
  });
  const response = await fetch(request);
  if (cacheable(response)) await cache.put(route, response);
}

async function primeApplicationShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(
    SHELL_ROUTES.map((route) => storeShellDocument(cache, route)).concat(
      [...SHELL_ASSETS].map((route) => storeShellAsset(cache, route)),
    ),
  );
}

self.addEventListener("install", (event) => {
  // A new release waits until the learner explicitly accepts the update.
  event.waitUntil(primeApplicationShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (
    request.mode === "navigate" &&
    isSameOrigin(url) &&
    url.pathname === "/"
  ) {
    event.respondWith(
      Promise.resolve(
        Response.redirect(new URL("/app", self.location.origin).href, 302),
      ),
    );
    return;
  }

  if (request.mode === "navigate" && isApplicationRoute(url)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (cacheable(response)) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
          }
          return safeNavigationResponse(response);
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match(request)) ||
            (await cache.match(url.pathname)) ||
            (await cache.match(url.pathname.startsWith("/app") ? "/app" : "/")) ||
            Response.error()
          );
        }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(request);
        if (cacheable(response)) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      }),
    );
  }
});
`;

export function GET() {
  return new Response(createServiceWorkerSource(buildId), {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'self'; connect-src 'self'",
      "Content-Type": "text/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
