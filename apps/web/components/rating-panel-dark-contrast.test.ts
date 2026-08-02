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

describe("dark rating panel contrast", () => {
  it("uses the strong popup edge for the panel and every rating control", () => {
    expect(styles).toMatch(
      /:root\[data-resolved-theme="dark"\] \.rating-panel\s*\{\s*border-color:\s*var\(--popup-border\);\s*\}/,
    );
    expect(styles).toMatch(
      /:root\[data-resolved-theme="dark"\] \.rating-panel button\s*\{\s*border:\s*2px solid var\(--control-border-strong\);\s*\}/,
    );
  });

  it("keeps the resolved dark edge above the non-text contrast threshold", () => {
    // Resolved dark-mode values for --popup-border and --surface.
    expect(contrast("b4b6bb", "3e424b")).toBeGreaterThanOrEqual(3);
  });
});
