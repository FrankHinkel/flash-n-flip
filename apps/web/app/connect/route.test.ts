import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("direct-connect bootstrap route", () => {
  it("redirects the stable short URL without leaking the internal proxy origin", () => {
    const response = GET();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/connect/index.html");
  });
});
