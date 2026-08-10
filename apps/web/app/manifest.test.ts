import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("application manifest", () => {
  it("uses the neutral application surface behind iPhone views", () => {
    expect(manifest()).toMatchObject({
      background_color: "#F7F6F2",
      id: "/",
      start_url: "/app",
      theme_color: "#F7F6F2",
    });
  });
});
