import {
  publicPwaFallbackCookieName,
  publicPwaFallbackCookieValue,
} from "../../lib/public-pwa-fallback";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 307,
    headers: {
      "cache-control": "no-store",
      location: "/app",
      "set-cookie": `${publicPwaFallbackCookieName}=${publicPwaFallbackCookieValue}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`,
    },
  });
}
