import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("bootstrap root", () => {
  it("redirects a fresh browser directly to the device connection shell", () => {
    const response = GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/connect/index.html");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
