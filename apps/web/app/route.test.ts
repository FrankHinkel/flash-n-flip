import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("PWA root", () => {
  it("redirects a fresh browser to the PWA entry", () => {
    const response = GET(new Request("https://flash-n-flip.test/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/pwa");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it.each(["localhost", "127.0.0.1"])(
    "opens the application directly on %s",
    (hostname) => {
      const response = GET(new Request(`http://${hostname}:3000/`));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/app");
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );
});
