import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("settings action layout", () => {
  it("keeps action icons beside their wrapping labels", () => {
    expect(styles).toMatch(
      /\.setting-row\s*\{[^}]*justify-content:\s*space-between;/s,
    );
    expect(styles).toMatch(
      /\.setting-action\s*\{[^}]*justify-content:\s*flex-start;/s,
    );
    expect(styles).toMatch(
      /\.setting-action\s*>\s*svg\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(styles).toMatch(
      /\.setting-action\s*>\s*span\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });
});
