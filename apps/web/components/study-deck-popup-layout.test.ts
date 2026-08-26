import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study deck popup alignment", () => {
  it("aligns the medium-width popup with the standard page inset", () => {
    expect(styles).toMatch(
      /@media \(min-width: 621px\) and \(max-width: 900px\)\s*\{\s*\.study-deck-menu\s*\{[^}]*left:\s*-54px;/s,
    );
  });

  it("keeps the narrow popup within the mobile viewport inset", () => {
    expect(styles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.study-deck-menu\s*\{[^}]*position:\s*fixed;[^}]*right:\s*16px;[^}]*left:\s*16px;/s,
    );
  });
});
