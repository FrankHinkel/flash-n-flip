import { describe, expect, it } from "vitest";

import {
  parsePeriodicTableSource,
  positionedPeriodicTableElements,
} from "./periodic-table";

describe("periodic-table source", () => {
  it("parses bounded explore and quiz directives", () => {
    expect(
      parsePeriodicTableSource(`mode quiz
focus Fe
highlight H, C, N, O
title Find iron
describe Iron is highlighted without revealing its detail panel.`),
    ).toMatchObject({
      mode: "QUIZ",
      focusAtomicNumber: 26,
      highlightedAtomicNumbers: [1, 6, 7, 8],
      title: "Find iron",
    });
  });

  it("contains every element exactly once at a bounded grid position", () => {
    expect(positionedPeriodicTableElements).toHaveLength(118);
    expect(
      new Set(positionedPeriodicTableElements.map((element) => element.symbol))
        .size,
    ).toBe(118);
    expect(
      positionedPeriodicTableElements.every(
        (element) =>
          element.column >= 1 &&
          element.column <= 18 &&
          element.row >= 1 &&
          element.row <= 9,
      ),
    ).toBe(true);
  });

  it.each([
    "focus Xx",
    "mode execute",
    "click H javascript:alert(1)",
    "title <img src=x onerror=alert(1)>",
    "highlight H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H,H",
  ])("rejects unsafe or unsupported source: %s", (source) => {
    expect(() => parsePeriodicTableSource(source)).toThrow();
  });
});
