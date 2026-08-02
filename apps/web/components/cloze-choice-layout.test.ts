import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const component = readFileSync(
  new URL("./rich-text-content.tsx", import.meta.url),
  "utf8",
);

const cssRule = (selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(styles);
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
};

describe("cloze choice popup layout", () => {
  it("collapses its choices when the viewport cannot fit two usable columns", () => {
    const menu = cssRule(".cloze-choice-menu");

    expect(menu).toContain("width: min(440px, calc(100vw - 32px))");
    expect(menu).toMatch(
      /grid-template-columns:\s*repeat\(\s*auto-fit,\s*minmax\(min\(100%, 180px\), 1fr\)\s*\)/,
    );
  });

  it("contains long words while reserving the audio touch target", () => {
    const value = cssRule(".cloze-choice-option .cloze-choice-value");
    const speech = cssRule(".cloze-choice-option .cloze-choice-speech");

    expect(value).toContain("min-width: 0");
    expect(value).toContain("overflow-wrap: anywhere");
    expect(value).toContain("white-space: normal");
    expect(speech).toContain("flex: 0 0 44px");
  });

  it("remeasures the natural popup size after every viewport change", () => {
    const clearWidth = 'menuRef.current.style.removeProperty("width")';
    const clearMaxHeight = 'menuRef.current.style.removeProperty("max-height")';
    const measure = "menuRef.current.getBoundingClientRect()";

    expect(component).toContain(clearWidth);
    expect(component).toContain(clearMaxHeight);
    expect(component.indexOf(clearWidth)).toBeLessThan(
      component.indexOf(measure),
    );
    expect(component.indexOf(clearMaxHeight)).toBeLessThan(
      component.indexOf(measure),
    );
  });
});
