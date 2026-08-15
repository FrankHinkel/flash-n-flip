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

describe("deck learning-plan appearance", () => {
  it("uses a persistent boundary and stronger icon for the active state", () => {
    expect(component).toContain('<GraduationCap aria-hidden="true"');

    const activeRule = styles.match(
      /\.learning-plan-button\.active\s*\{([^}]*)\}/,
    )?.[1];
    expect(activeRule).toContain("background: var(--primary-soft)");
    expect(activeRule).toContain("box-shadow:");
    expect(activeRule).toContain("color: var(--ink)");
  });
});
