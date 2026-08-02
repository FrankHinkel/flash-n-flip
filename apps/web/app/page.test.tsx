import { describe, expect, it } from "vitest";

import LoginPage from "./login/page";
import Home from "./page";

describe("PWA root recovery", () => {
  it("returns a successful document instead of a server redirect", () => {
    expect(Home().type).toBe(LoginPage);
  });
});
