import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("direct-connect bootstrap route", () => {
  it("redirects the stable short URL without leaking the internal proxy origin", () => {
    const response = GET(new Request("https://flash-n-flip.test/connect"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/connect/index.html");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("marks intentional navigation from the installed app", () => {
    const response = GET(
      new Request("https://flash-n-flip.test/connect?source=app"),
    );
    expect(response.headers.get("location")).toBe(
      "/connect/index.html?source=app",
    );
  });
});
