import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

const luminance = (hex: string): number => {
  const channels = hex
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

const contrast = (first: string, second: string): number => {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
};

describe("dark popup separation", () => {
  it("keeps the popup edge distinguishable from its raised surface", () => {
    // Resolved values of the dark-mode color mixes in styles.css.
    expect(contrast("595c63", "b4b6bb")).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ".deck-actions-popover",
    ".reset-dialog",
    ".cloze-choice-menu",
    ".study-deck-menu",
    ".study-language-menu",
    ".map-answer-panel",
    ".map-information-settings-menu",
    ".map-region-info",
    ".map-country-list",
  ])("uses the shared popup treatment for %s", (selector) => {
    const selectorMatch = new RegExp(
      `${selector.replace(".", "\\.")}(?=\\s*[,\\{])`,
    ).exec(styles);
    const selectorIndex = selectorMatch?.index ?? -1;
    const ruleEnd = styles.indexOf("}", selectorIndex);
    const rule =
      selectorIndex >= 0 && ruleEnd >= 0
        ? styles.slice(selectorIndex, ruleEnd + 1)
        : undefined;

    expect(rule).toBeDefined();
    expect(rule).toContain("var(--popup-");
  });

  it("does not flatten popup menus through the generic dark surface rule", () => {
    const genericDarkSurfaceRule = styles.match(
      /:root\[data-resolved-theme="dark"\]\s+:is\(([\s\S]*?)\)\s*\{\s*background:\s*var\(--surface\);/,
    )?.[1];

    expect(genericDarkSurfaceRule).toBeDefined();
    expect(genericDarkSurfaceRule).not.toContain(".study-deck-menu");
    expect(genericDarkSurfaceRule).not.toContain(".study-language-menu");
  });
});
