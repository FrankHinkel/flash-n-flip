import { isLocalDevelopmentHostname } from "../lib/local-development-runtime";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const destination = isLocalDevelopmentHostname(new URL(request.url).hostname)
    ? "/app"
    : "/pwa";

  return new Response(null, {
    status: 307,
    headers: {
      "cache-control": "no-store",
      location: destination,
    },
  });
}
