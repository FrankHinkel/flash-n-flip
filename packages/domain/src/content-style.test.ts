import { describe, expect, it } from "vitest";

import {
  contentStyleDefinitionSchema,
  defaultContentStyles,
  mergeContentStyles,
  resolveContentStyles,
} from "./content-style.js";

describe("deck content styles", () => {
  it("provides accessible bright and dark defaults", () => {
    expect(defaultContentStyles.map((style) => style.name)).toEqual([
      "hint",
      "accent",
    ]);
    expect(defaultContentStyles).toEqual(
      defaultContentStyles.map((style) =>
        contentStyleDefinitionSchema.parse(style),
      ),
    );
  });

  it("rejects low-contrast and executable style values", () => {
    expect(
      contentStyleDefinitionSchema.safeParse({
        name: "unsafe",
        bright: { color: "#ffffff", backgroundColor: "#ffffff" },
        dark: {
          color: "url(javascript:alert(1))",
          backgroundColor: "#000000",
        },
      }).success,
    ).toBe(false);
  });

  it("cascades from parent to child and lets the nearest deck override by name", () => {
    const childAccent = {
      ...defaultContentStyles[1]!,
      bright: {
        ...defaultContentStyles[1]!.bright,
        color: "#000000",
        backgroundColor: "#ffffff",
      },
    };
    const resolved = resolveContentStyles(
      [
        {
          id: "root",
          parentDeckId: null,
          contentStyles: defaultContentStyles,
        },
        {
          id: "child",
          parentDeckId: "root",
          contentStyles: [childAccent],
        },
      ],
      "child",
    );

    expect(resolved.map((style) => style.name)).toEqual(["hint", "accent"]);
    expect(resolved.find((style) => style.name === "accent")?.bright).toEqual(
      childAccent.bright,
    );
  });

  it("keeps root defaults while replacing an explicitly customized style", () => {
    const customized = {
      ...defaultContentStyles[1]!,
      bright: {
        ...defaultContentStyles[1]!.bright,
        color: "#000000",
        backgroundColor: "#ffffff",
      },
    };

    expect(
      mergeContentStyles(defaultContentStyles, [customized]).map(
        (style) => style.name,
      ),
    ).toEqual(["hint", "accent"]);
    expect(
      mergeContentStyles(defaultContentStyles, [customized]).find(
        (style) => style.name === "accent",
      )?.bright,
    ).toEqual(customized.bright);
  });
});
