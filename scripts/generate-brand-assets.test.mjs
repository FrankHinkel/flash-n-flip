import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createBrandThemes,
  extractBrandColors,
  sanitizeBrandSvg,
} from "./generate-brand-assets.mjs";

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

test("sanitizes the checked-in brand SVG", () => {
  const source = fs.readFileSync("Ressourcen/Flash-n-Flip.svg", "utf8");
  const sanitized = sanitizeBrandSvg(source);
  assert.match(sanitized, /^<svg xmlns=/);
  assert.doesNotMatch(sanitized, /<!DOCTYPE|<\?xml|xmlns:xlink/);
  assert.deepEqual(extractBrandColors(sanitized), {
    yellow: "#F5C505",
    navy: "#0C276C",
    blue: "#0F6AFA",
  });
});

test("keeps generated bright and dark text colors at WCAG AA contrast", () => {
  const themes = createBrandThemes({
    yellow: "#F5C505",
    navy: "#0C276C",
    blue: "#0F6AFA",
  });
  for (const [foreground, background] of [
    ["#FFFFFF", themes.bright.primary],
    [themes.bright.ink, themes.bright.paper],
    [themes.bright.muted, themes.bright.paper],
    [themes.dark.ink, themes.dark.paper],
    [themes.dark.muted, themes.dark.surface],
    [themes.dark.highlight, themes.dark.paper],
  ]) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} must meet 4.5:1 contrast`,
    );
  }
});

test("rejects an incomplete brand palette", () => {
  assert.throws(
    () =>
      extractBrandColors(
        '<svg><rect style="fill:rgb(1, 2, 3)" /><path style="fill:rgb(4, 5, 6)" /></svg>',
      ),
    /one colored background and two colored mark paths/,
  );
});

test("regenerates theme outputs when the master colors change", () => {
  const source = fs
    .readFileSync("Ressourcen/Flash-n-Flip.svg", "utf8")
    .replace("rgb(245,197,5)", "rgb(240,190,10)");
  assert.equal(extractBrandColors(source).yellow, "#F0BE0A");
});

for (const malicious of [
  '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
  '<svg viewBox="0 0 1 1"><path onload="alert(1)" /></svg>',
  '<svg viewBox="0 0 1 1"><image href="https://tracker.invalid/a" /></svg>',
  '<svg viewBox="0 0 1 1"><path style="fill:url(https://x)" /></svg>',
  '<svg viewBox="0 0 1 1"><foreignObject>HTML</foreignObject></svg>',
]) {
  test(`rejects unsafe SVG markup: ${malicious.slice(0, 45)}`, () => {
    assert.throws(() => sanitizeBrandSvg(malicious), /forbidden markup/);
  });
}
