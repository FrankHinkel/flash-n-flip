import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const policy = readFileSync(
  new URL("../app/typography.css", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
describe("shared study typography", () => {
  it("defines phone, tablet and desktop study ranges centrally", () => {
    expect(policy).toContain("--study-base: 1.375rem");
    expect(policy).toContain("--study-base: 1.5rem");
    expect(policy).toContain("--study-base: 1.625rem");
    expect(policy).toContain(
      "--study-font-min: calc(var(--study-min-base) / var(--device-font-factor))",
    );
  });
  it("does not use independent viewport or Markdown study scales", () => {
    expect(styles).not.toContain("--study-card-content-font-size");
    expect(styles).not.toContain("--markdown-card-font-size");
    expect(styles).toContain("var(--study-font-size, 22px)");
    expect(policy).toContain(
      "font-size: calc(100% * var(--device-font-factor) * var(--system-text-scale))",
    );
  });
});
