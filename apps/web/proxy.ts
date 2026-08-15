import { type NextRequest, NextResponse } from "next/server";

import {
  publicPwaFallbackCookieName,
  publicPwaFallbackCookieValue,
} from "./lib/public-pwa-fallback";

export function proxy(request: NextRequest) {
  if (
    request.cookies.get(publicPwaFallbackCookieName)?.value ===
    publicPwaFallbackCookieValue
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(new URL("/pwa", request.url), 307);
  response.headers.set("cache-control", "no-store");
  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/community/:path*",
    "/login",
    "/register",
    "/password-change",
    "/password-reset",
  ],
};
