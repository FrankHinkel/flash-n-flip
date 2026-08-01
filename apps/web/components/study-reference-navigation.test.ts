import { describe, expect, it } from "vitest";

import {
  adjacentReferenceIndex,
  shouldShowReferenceContent,
} from "./study-reference-navigation";

describe("study reference navigation", () => {
  it("opens a developer reference directly on its content", () => {
    expect(shouldShowReferenceContent(true, true)).toBe(true);
    expect(shouldShowReferenceContent(true, false)).toBe(false);
    expect(shouldShowReferenceContent(false, true)).toBe(false);
  });

  it("moves in both directions without leaving the reference range", () => {
    expect(adjacentReferenceIndex(1, 3, "previous")).toBe(0);
    expect(adjacentReferenceIndex(1, 3, "next")).toBe(2);
    expect(adjacentReferenceIndex(0, 3, "previous")).toBe(0);
    expect(adjacentReferenceIndex(2, 3, "next")).toBe(2);
    expect(adjacentReferenceIndex(0, 0, "next")).toBe(0);
  });
});
