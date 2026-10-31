import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
describe("Discover responsive controls", () => {
  it("keeps categories in a single column on phones and allows offer actions to wrap", () => {
    expect(styles).toMatch(
      /\.discover-categories\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/,
    );
    expect(styles).toMatch(
      /\.discover-offer\s*\{\s*flex-direction: column;\s*align-items: stretch/,
    );
    expect(styles).toMatch(
      /\.discover-preview-controls \.button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s,
    );
  });
});
