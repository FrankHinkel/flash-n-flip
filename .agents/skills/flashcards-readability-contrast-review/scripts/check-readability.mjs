#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.argv[2] ?? process.cwd());
const scanRoots = ["apps/web", "apps/admin", "apps/mobile", "packages/design"];
const supportedExtensions = new Set([".css", ".ts", ".tsx"]);
const ignoredDirectories = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
]);

const failures = [];
const reviews = [];
const themeColors = new Map();

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name)
        ? []
        : walk(path.join(directory, entry.name));
    }
    const file = path.join(directory, entry.name);
    return supportedExtensions.has(path.extname(entry.name)) ? [file] : [];
  });
}

function relative(file) {
  return path.relative(repositoryRoot, file);
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function parseHex(value) {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!match) return null;
  const hex =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function luminance(rgb) {
  const channels = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function normalizeColor(value) {
  if (!value) return null;
  const normalized = value.replace(/\s*!important\s*$/, "").trim();
  if (normalized === "white") return "#ffffff";
  if (normalized === "black") return "#000000";
  if (parseHex(normalized)) return normalized;

  const theme = normalized.match(/^colors\.([\w]+)$/);
  if (theme) return themeColors.get(theme[1]) ?? null;
  return null;
}

function property(body, name) {
  const expression = new RegExp(
    `(?:^|[;,\\n])\\s*${name}\\s*:\\s*([^;,\\n}]+)`,
    "i",
  );
  return (
    body
      .match(expression)?.[1]
      ?.trim()
      .replace(/^["']|["']$/g, "") ?? null
  );
}

function isBold(value) {
  if (!value) return false;
  return value === "bold" || Number.parseInt(value, 10) >= 700;
}

function requiredRatio(platform, size, weight) {
  const bold = isBold(weight);
  const large =
    platform === "web"
      ? size >= 24 || (bold && size >= 18.66)
      : size >= 18 || (bold && size >= 14);
  return large ? 3 : 4.5;
}

const files = scanRoots.flatMap((root) =>
  walk(path.join(repositoryRoot, root)),
);

for (const file of files.filter((candidate) =>
  candidate.endsWith("theme.ts"),
)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /^\s*([\w]+)\s*:\s*["'](#[0-9a-fA-F]{3,6})["']/gm,
  )) {
    themeColors.set(match[1], match[2]);
  }
}

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const fileName = relative(file);

  if (file.endsWith(".css")) {
    for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = block[1].trim().replace(/\s+/g, " ");
      const body = block[2];
      const foregroundValue = property(body, "color");
      const backgroundValue = property(body, "background(?:-color)?");
      const size = Number.parseFloat(property(body, "font-size") ?? "16");
      const weight = property(body, "font-weight");
      const opacity = Number.parseFloat(property(body, "opacity") ?? "1");
      const line = lineNumber(source, block.index ?? 0);

      if (Number.isFinite(size) && size > 0 && size < 12) {
        reviews.push(
          `${fileName}:${line} tiny Web text (${size}px) in ${selector}`,
        );
      }
      if (
        Number.isFinite(opacity) &&
        opacity < 0.75 &&
        (foregroundValue || /font|text/i.test(body))
      ) {
        reviews.push(
          `${fileName}:${line} text-related opacity ${opacity} in ${selector}`,
        );
      }
      if (
        foregroundValue &&
        /gradient|rgba?\(|#(?:[0-9a-fA-F]{4}|[0-9a-fA-F]{8})\b/.test(
          backgroundValue ?? foregroundValue,
        )
      ) {
        reviews.push(
          `${fileName}:${line} transparent or variable background in ${selector}`,
        );
      }
      if (!foregroundValue || !backgroundValue) continue;

      // CSS custom properties can change per theme and media query. Resolve them
      // in the rendered-state review instead of producing a false static result.
      const foreground = normalizeColor(foregroundValue);
      const background = normalizeColor(backgroundValue);
      if (!foreground || !background) {
        reviews.push(
          `${fileName}:${line} rendered contrast required in ${selector} (${foregroundValue} on ${backgroundValue})`,
        );
        continue;
      }

      const ratio = contrastRatio(parseHex(foreground), parseHex(background));
      const required = requiredRatio("web", size, weight);
      if (ratio < required) {
        failures.push(
          `${fileName}:${line} ${selector}: ${foreground} on ${background} = ${ratio.toFixed(2)}:1, requires ${required}:1`,
        );
      }
    }
  } else {
    for (const block of source.matchAll(/\{([^{}]{0,800})\}/g)) {
      const body = block[1];
      const foregroundValue = property(body, "color");
      const backgroundValue = property(body, "backgroundColor");
      const size = Number.parseFloat(property(body, "fontSize") ?? "14");
      const weight = property(body, "fontWeight")?.replace(/["']/g, "");
      const opacity = Number.parseFloat(property(body, "opacity") ?? "1");
      const line = lineNumber(source, block.index ?? 0);

      if (Number.isFinite(size) && property(body, "fontSize") && size < 12) {
        reviews.push(`${fileName}:${line} tiny native text (${size}pt)`);
      }
      if (
        Number.isFinite(opacity) &&
        opacity < 0.75 &&
        (foregroundValue || /font|text/i.test(body))
      ) {
        reviews.push(`${fileName}:${line} text-related opacity ${opacity}`);
      }
      if (!foregroundValue || !backgroundValue) continue;

      const foreground = normalizeColor(foregroundValue);
      const background = normalizeColor(backgroundValue);
      if (!foreground || !background) {
        reviews.push(`${fileName}:${line} unresolved native color pair`);
        continue;
      }

      const ratio = contrastRatio(parseHex(foreground), parseHex(background));
      const required = requiredRatio("native", size, weight);
      if (ratio < required) {
        failures.push(
          `${fileName}:${line} native pair ${foreground} on ${background} = ${ratio.toFixed(2)}:1, requires ${required}:1`,
        );
      }
    }
  }
}

for (const failure of failures) console.error(`FAIL ${failure}`);
for (const review of reviews) console.log(`REVIEW ${review}`);
console.log(
  `Readability scan: ${failures.length} failure(s), ${reviews.length} review item(s).`,
);

if (failures.length > 0) process.exitCode = 1;
