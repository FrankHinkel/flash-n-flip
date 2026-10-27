import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study deck popup alignment", () => {
  it("does not reserve a removed theme button slot in the study header", () => {
    expect(styles).toContain(".study-header {\n  padding-inline: 0;");
  });
  it("anchors medium and desktop menus to the deck control", () => {
    expect(styles).toMatch(
      /\.study-deck-menu\s*\{[^}]*position:\s*absolute;[^}]*left:\s*0;/s,
    );
  });

  it("keeps the narrow popup within the mobile viewport inset", () => {
    expect(styles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.study-deck-menu\s*\{[^}]*position:\s*fixed;[^}]*right:\s*16px;[^}]*left:\s*16px;/s,
    );
  });
});
