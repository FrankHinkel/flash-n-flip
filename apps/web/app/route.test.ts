import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("PWA root", () => {
  it("redirects a fresh browser to the PWA entry", () => {
    const response = GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/pwa");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
