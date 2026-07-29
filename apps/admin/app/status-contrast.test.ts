import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function selectorBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  expect(match, `Missing CSS selector: ${selector}`).not.toBeNull();
  return match![1]!;
}

function declaredHex(body: string, property: string): string {
  const match = body.match(
    new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(#[0-9a-f]{6})`, "i"),
  );
  expect(match, `Missing explicit ${property} declaration`).not.toBeNull();
  return match![1]!;
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

describe("admin status-message contrast", () => {
  test.each([
    ["bright", ".admin-message"],
    ["dark", ':root[data-resolved-theme="dark"] .admin-message'],
    ["bright error", ".admin-error"],
    ["dark error", ':root[data-resolved-theme="dark"] .admin-error'],
  ])("%s status text meets WCAG AA", (_name, selector) => {
    const body = selectorBody(selector);
    const foreground = declaredHex(body, "color");
    const background = declaredHex(body, "background");

    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});
