import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const catalog = readFileSync(
  new URL("./deck-catalog.tsx", import.meta.url),
  "utf8",
);

describe("discover collection leading icons", () => {
  it("renders every language and library mark through the shared class", () => {
    expect(catalog.match(/className="language-catalog-mark"/g)).toHaveLength(1);
    expect(
      catalog.match(
        /className="language-catalog-mark language-catalog-mark-multi"/g,
      ),
    ).toHaveLength(3);
  });

  it("removes icon tiles and keeps their column narrower than the text gap", () => {
    expect(styles).toMatch(
      /\.language-catalog-mark\s*\{[^}]*width:\s*46px;[^}]*height:\s*46px;[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-radius:\s*0;/s,
    );
    expect(styles).toMatch(
      /\.geography-catalog-intro\s*>\s*:is\([^)]*\.language-catalog-mark\)\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*border-radius:\s*0;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.language-catalog-mark\s*\{[^}]*width:\s*42px;[^}]*height:\s*42px;[^}]*flex-basis:\s*42px;/,
    );
  });
});
