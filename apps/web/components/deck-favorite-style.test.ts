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
  it("uses a larger, borderless and stronger icon for the active state", () => {
    expect(component).toContain('<GraduationCap aria-hidden="true"');

    const activeRule = styles.match(
      /\.learning-plan-button\.active\s*\{([^}]*)\}/,
    )?.[1];
    expect(activeRule).toContain("color: var(--focus)");
    expect(activeRule).toContain("background: transparent");
    expect(activeRule).toContain("box-shadow: none");
    expect(styles).toMatch(
      /\.learning-plan-button svg,\s*\.deck-menu-trigger svg\s*\{[^}]*width:\s*27px;[^}]*height:\s*27px;/s,
    );
    expect(styles).toMatch(
      /\.learning-plan-button\.active svg\s*\{[^}]*stroke-width:\s*2\.75;/s,
    );
  });

  it("styles the three-dot hover, focus and open states on the icon", () => {
    expect(component).toContain('<EllipsisVertical aria-hidden="true"');
    expect(component).toContain("aria-expanded={openMenuId === deck.id}");
    expect(styles).toMatch(
      /\.deck-menu-trigger:hover,[\s\S]*?\.deck-menu-trigger\[aria-expanded="true"\]\s*\{[^}]*color:\s*var\(--focus\);[^}]*background:\s*transparent;[^}]*outline:\s*0;/,
    );
    expect(styles).toMatch(
      /\.deck-menu-trigger:focus-visible svg\s*\{[^}]*filter:\s*drop-shadow/s,
    );
  });
});
