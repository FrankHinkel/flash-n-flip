import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

const macStylesStart = styles.indexOf(
  "/* The iPad app running on macOS uses the Web sidebar",
);
const macStylesEnd = styles.indexOf(
  ':root[data-native-tab-bar="true"]',
  macStylesStart,
);
const macStyles = styles.slice(macStylesStart, macStylesEnd);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function declaration(
  source: string,
  selector: string,
  property: string,
): string | undefined {
  const rule = source.match(
    new RegExp(
      `${escapeRegex(selector)}(?:\\s*,\\s*[^{}]+)?\\s*\\{([^}]*)\\}`,
      "s",
    ),
  );
  const value = rule?.[1]?.match(
    new RegExp(`(?:^|;)\\s*${escapeRegex(property)}\\s*:\\s*([^;]+)`),
  )?.[1];
  return value?.trim().replace(/\\s+/g, " ");
}

function fontSize(source: string, selector: string): string | undefined {
  const explicitSize = declaration(source, selector, "font-size");
  if (explicitSize) return explicitSize;

  const font = declaration(source, selector, "font");
  return font?.match(
    /(?:^|\s)(clamp\([^)]*\)|var\([^)]*\)|\d+(?:\.\d+)?px)(?=\/|\s|$)/,
  )?.[1];
}

function expectUniform(
  property: string,
  valuesByView: Record<"overview" | "decks" | "discover", string>,
) {
  expect(
    new Set(Object.values(valuesByView)).size,
    `${property} differs between main views: ${JSON.stringify(valuesByView)}`,
  ).toBe(1);
}

describe("Overview, Decks, and Discover layout consistency on Mac for iPad", () => {
  it("uses one size for the primary visible heading", () => {
    expectUniform("primary heading size", {
      overview: fontSize(styles, ".today-card h2") ?? "inherited",
      decks: fontSize(styles, ".app-header h1") ?? "inherited",
      discover: fontSize(styles, ".result-heading :is(h1, h2)") ?? "inherited",
    });
  });

  it("uses one size for general explanatory text", () => {
    const macBodySize =
      fontSize(
        macStyles,
        ':root[data-apple-interface-platform="mac"] .app-content',
      ) ?? "inherited";

    expectUniform("general explanatory text size", {
      overview: fontSize(styles, ".today-card p") ?? macBodySize,
      decks:
        fontSize(
          macStyles,
          ':root[data-apple-interface-platform="mac"] .deck-title-description',
        ) ??
        fontSize(styles, ".deck-title-description") ??
        macBodySize,
      discover: fontSize(styles, ".geography-catalog p") ?? macBodySize,
    });
  });

  it("uses one page-level content inset", () => {
    const appPagePadding =
      declaration(styles, ".app-page", "padding") ?? "unset";

    expectUniform("page-level content inset", {
      overview: appPagePadding,
      decks: appPagePadding,
      discover: appPagePadding,
    });
  });
});
