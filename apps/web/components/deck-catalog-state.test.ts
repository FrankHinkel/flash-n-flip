import { describe, expect, it } from "vitest";

import { createInitialExpandedContinents } from "./deck-catalog-state";

describe("deck catalog initial state", () => {
  it("starts with every geography continent collapsed", () => {
    expect([...createInitialExpandedContinents()]).toEqual([]);
  });

  it("creates isolated state for each catalog instance", () => {
    const first = createInitialExpandedContinents();
    first.add("europe");

    expect([...createInitialExpandedContinents()]).toEqual([]);
  });
});
