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
  it("wraps choices according to their content within the current viewport", () => {
    const menu = cssRule(".cloze-choice-menu");

    expect(menu).toContain("width: fit-content");
    expect(menu).toContain("max-width: min(620px, calc(100vw - 32px))");
    expect(menu).toContain("display: flex");
    expect(menu).toContain("flex-wrap: wrap");
    expect(menu).toContain("font-size: clamp(16px, 4vw, 22px)");
    expect(menu).toContain("touch-action: pan-y");
    expect(menu).toContain("-webkit-overflow-scrolling: touch");
  });

  it("sizes each choice from its content while reserving the audio touch target", () => {
    const option = cssRule(".cloze-choice-option");
    const value = cssRule(".cloze-choice-option .cloze-choice-value");
    const breakableValue = cssRule(
      ".cloze-choice-option .cloze-choice-value--breakable",
    );
    const speech = cssRule(".cloze-choice-option .cloze-choice-speech");

    expect(option).toContain("grid-template-columns: minmax(0, 1fr) 44px");
    expect(option).toContain("flex: 1 1 154px");
    expect(option).toContain("max-width: 100%");
    expect(value).toContain("min-width: 0");
    expect(value).toContain("white-space: nowrap");
    expect(breakableValue).toContain("hyphens: auto");
    expect(breakableValue).toContain("overflow-wrap: anywhere");
    expect(breakableValue).toContain("white-space: normal");
    expect(speech).toContain("width: 44px");
  });

  it("only lets genuinely long choice words wrap", () => {
    expect(component).toContain(".some((word) => word.length > 18)");
    expect(component).toContain("cloze-choice-value--breakable");
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
    expect(component).toContain("style.width = previousWidth");
    expect(component).toContain("style.maxHeight = previousMaxHeight");
    expect(component).toContain("event.target !== menuRef.current");
  });

  it("renders the popup outside clipping card containers and protects the answer action", () => {
    expect(component).toContain("createPortal(");
    expect(component).toContain("document.body");
    expect(component).toContain('querySelector<HTMLElement>(".reveal-button")');
    expect(component).toContain("verticalBounds");
    expect(component).toContain("menuRef.current?.contains");
  });
});
