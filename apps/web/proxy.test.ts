import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  publicPwaFallbackCookieName,
  publicPwaFallbackCookieValue,
} from "./lib/public-pwa-fallback";
import { config, proxy } from "./proxy";

describe("peer-first product route boundary", () => {
  it.each([
    "/app",
    "/app/decks",
    "/community",
    "/login",
    "/register",
    "/password-change",
    "/password-reset",
  ])("redirects a fresh server request for %s to the PWA entry", (path) => {
    const response = proxy(new NextRequest(`https://flash-n-flip.test${path}`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://flash-n-flip.test/pwa",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("allows the explicitly selected public PWA fallback", () => {
    const response = proxy(
      new NextRequest("https://flash-n-flip.test/app", {
        headers: {
          cookie: `${publicPwaFallbackCookieName}=${publicPwaFallbackCookieValue}`,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("covers every server-hosted product route", () => {
    expect(config.matcher).toEqual([
      "/app/:path*",
      "/community/:path*",
      "/login",
      "/register",
      "/password-change",
      "/password-reset",
    ]);
  });
});
