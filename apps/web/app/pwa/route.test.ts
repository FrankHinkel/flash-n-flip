import { describe, expect, it } from "vitest";

import {
  publicPwaFallbackCookieName,
  publicPwaFallbackCookieValue,
} from "../../lib/public-pwa-fallback";
import { GET } from "./route";

describe("explicit public PWA fallback", () => {
  it("opens the product UI only after recording the deliberate fallback choice", () => {
    const response = GET(new Request("https://flash-n-flip.test/pwa"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/app");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain(
      `${publicPwaFallbackCookieName}=${publicPwaFallbackCookieValue}`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=31536000");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("keeps local HTTP development usable", () => {
    const response = GET(new Request("http://127.0.0.1:3000/pwa"));

    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });
});
