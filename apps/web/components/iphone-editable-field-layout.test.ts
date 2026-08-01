import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("iPhone editable field layout", () => {
  it("keeps text-entry controls at the iOS no-zoom minimum", () => {
    expect(styles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?input:not\(\[type="button"\]\)[\s\S]*?textarea,[\s\S]*?select[\s\S]*?font-size:\s*max\(16px, 1em\);/,
    );
  });

  it("locks the application shell to the viewport while fields focus", () => {
    expect(styles).toMatch(
      /\.app-layout\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*overflow:\s*hidden;/s,
    );
  });
});
