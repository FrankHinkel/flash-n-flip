import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("direct-connect bootstrap route", () => {
  it("redirects the stable short URL to the generated static shell", () => {
    const response = GET(new Request("https://flash-n-flip.com/connect"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://flash-n-flip.com/connect/index.html",
    );
  });
});
