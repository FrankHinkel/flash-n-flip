import { describe, expect, it } from "vitest";

import { api } from "./api";

describe("Web API routing", () => {
  it("always uses the same-origin proxy", () => {
    expect(api.baseUrl).toBe("/api");
  });
});
