import { describe, expect, it } from "vitest";

import Home from "./page";

describe("PWA root recovery", () => {
  it("redirects the root to the public PWA entry", () => {
    expect(() => Home()).toThrow();
  });
});
