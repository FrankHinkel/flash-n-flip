import { describe, expect, it } from "vitest";

import {
  developerReferenceDeckIds,
  developerReferenceTag,
  hasDeveloperReferenceTag,
  hasOptionalPracticeTag,
  optionalPracticeTag,
} from "./deck-study-mode.js";

describe("deck study mode", () => {
  it("recognizes the canonical developer reference tag", () => {
    expect(hasDeveloperReferenceTag(["Git"], [developerReferenceTag])).toBe(
      true,
    );
    expect(hasDeveloperReferenceTag(["Git"], undefined)).toBe(false);
  });

  it("recognizes optional focused practice without changing normal decks", () => {
    expect(hasOptionalPracticeTag(["Grammar"], [optionalPracticeTag])).toBe(
      true,
    );
    expect(hasOptionalPracticeTag(["Grammar"], undefined)).toBe(false);
  });

  it("inherits reference mode through a deck hierarchy", () => {
    expect([
      ...developerReferenceDeckIds([
        {
          id: "reference-root",
          parentDeckId: null,
          tags: [developerReferenceTag],
        },
        { id: "reference-child", parentDeckId: "reference-root", tags: [] },
        { id: "learning", parentDeckId: null, tags: ["Grammar"] },
      ]),
    ]).toEqual(["reference-root", "reference-child"]);
  });
});
