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
  it("offers a direct preset and an explicit choice in normal Anki import", () => {
    expect(component).toContain('value: "XEFJORD"');
    expect(component).toContain("importXefjordPackage");
    expect(component).toContain("Xefjord-Preset verwenden");
    expect(component).toContain("Als normales Anki konfigurieren");
    expect(component).toContain('type="radio"');
    expect(component).toContain("key={format}");
  });

  it("explains automatic recognition and safe SVG handling", () => {
    expect(component).toContain("Xefjord-Collection-Namen");
    expect(component).toContain("strikte Vektor-Allowlist");
    expect(component).toContain("unsichere SVGs werden ausgelassen");
  });

  it("keeps format and preset choices usable on narrow screens", () => {
    expect(styles).toMatch(
      /\.import-format-option\s*\{[^}]*min-height:\s*104px;/s,
    );
    expect(styles).toMatch(
      /\.xefjord-preset-action\s*\{[^}]*min-height:\s*104px;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.xefjord-preset-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
  });
});
