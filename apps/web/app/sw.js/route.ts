const buildId = process.env.NEXT_PUBLIC_FNF_WEB_BUILD_ID || "development";

export const dynamic = "force-static";

export const createUpdateServiceWorkerSource = (version: string): string => `
const BUILD_ID = ${JSON.stringify(version)};

self.addEventListener("install", () => {
  // A new release waits until the learner explicitly accepts the update.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Keep the build identity in the generated source so browsers detect releases.
void BUILD_ID;
`;

export function GET() {
  return new Response(createUpdateServiceWorkerSource(buildId), {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'",
      "Content-Type": "text/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
