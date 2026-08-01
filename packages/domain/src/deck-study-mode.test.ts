import { describe, expect, it } from "vitest";

import {
  developerReferenceTag,
  hasDeveloperReferenceTag,
} from "./deck-study-mode.js";

describe("deck study mode", () => {
  it("recognizes the canonical developer reference tag", () => {
    expect(hasDeveloperReferenceTag(["Git"], [developerReferenceTag])).toBe(
      true,
    );
    expect(hasDeveloperReferenceTag(["Git"], undefined)).toBe(false);
  });
});
