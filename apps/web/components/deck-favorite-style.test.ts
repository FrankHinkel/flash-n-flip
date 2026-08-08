import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./deck-list.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("deck favorite appearance", () => {
  it("keeps the button neutral and fills only the selected star", () => {
    expect(component).toContain(
      'fill={deck.favorite ? "var(--brand-highlight)" : "none"}',
    );

    const activeRule = styles.match(
      /\.favorite-button\.active\s*\{([^}]*)\}/,
    )?.[1];
    expect(activeRule).toContain("background: transparent");
    expect(activeRule).toContain("color: var(--ink)");
    expect(activeRule).not.toContain("var(--yellow)");
  });
});
