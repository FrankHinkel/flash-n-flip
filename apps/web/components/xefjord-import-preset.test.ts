import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./import-cards.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("Xefjord import preset", () => {
  it("uses the built-in profile through the standard Anki importer", () => {
    expect(component).not.toContain('value: "XEFJORD"');
    expect(component).not.toContain("importXefjordPackage");
    expect(component).toContain("AnkiImportProfileEditor");
    expect(component).toContain("xefjordAnkiProfileId");
    expect(component).toContain('type="radio"');
    expect(component).toContain("key={format}");
  });

  it("explains automatic recognition and safe SVG handling", () => {
    expect(component).toContain("Xefjord-Complete-Karten");
    expect(component).toContain("strikte Vektor-Allowlist");
    expect(component).toContain("unsichere SVGs werden ausgelassen");
  });

  it("sends the selected profile with the normal commit", () => {
    expect(component).toContain("profileSelection,");
    expect(component).toContain("api.commitAnkiPackage");
  });

  it("keeps format and preset choices usable on narrow screens", () => {
    expect(styles).toMatch(
      /\.import-format-option\s*\{[^}]*min-height:\s*104px;/s,
    );
    expect(styles).toMatch(
      /\.anki-profile-actions button,[\s\S]*?min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.anki-profile-output\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
  });
});
