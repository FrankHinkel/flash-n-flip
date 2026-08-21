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

  it("styles only true active and open states without hover or visible focus", () => {
    expect(component).toContain('<EllipsisVertical aria-hidden="true"');
    expect(component).toContain("aria-expanded={openMenuId === deck.id}");
    expect(styles).toMatch(
      /\.deck-menu-trigger\[aria-expanded="true"\]\s*\{[^}]*color:\s*var\(--focus\);[^}]*background:\s*transparent;[^}]*outline:\s*0;/,
    );
    expect(styles).not.toContain(".learning-plan-button:hover");
    expect(styles).not.toContain(".deck-menu-trigger:hover");
    expect(styles).toMatch(
      /\.learning-plan-button:focus-visible,\s*\.deck-menu-trigger:focus-visible\s*\{[^}]*outline:\s*0;/s,
    );
    expect(styles).not.toMatch(
      /\.(?:learning-plan-button|deck-menu-trigger):focus-visible svg\s*\{/,
    );
  });

  it("uses a stronger divider aligned with each hierarchy level", () => {
    expect(styles).toMatch(
      /\.deck-tree-row::after\s*\{[^}]*left:\s*calc\(12px \+ var\(--tree-indent\)\);[^}]*height:\s*3px;[^}]*background:\s*color-mix\(in srgb, var\(--ink\) 24%, var\(--border\)\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.deck-tree-row::after\s*\{[^}]*left:\s*calc\(7px \+ var\(--tree-indent\)\);/s,
    );
  });

  it("moves carets upward and carries the selected cap color into row text", () => {
    expect(styles).toMatch(
      /\.tree-toggle\s*\{[^}]*align-self:\s*start;[^}]*\}[\s\S]*?\.tree-toggle svg\s*\{[^}]*transform:\s*translateY\(-3px\);/s,
    );
    expect(component).toContain('"learning-active"');
    expect(styles).toMatch(
      /\.deck-tree-row\.learning-active \.deck-tree-main,[\s\S]*?\.deck-tree-row\.learning-active \.deck-summary-metrics\s*\{[^}]*color:\s*var\(--focus\);/s,
    );
  });

  it("uses a speech bubble for the Language Hub and compact horizontal actions", () => {
    expect(component).toContain('<MessageCircle aria-hidden="true"');
    expect(styles).toMatch(
      /\.deck-row-actions\s*\{[^}]*width:\s*88px;[^}]*min-height:\s*44px;[^}]*flex-direction:\s*row;/s,
    );
    expect(styles).toMatch(
      /\.deck-actions-popover\s*\{[^}]*top:\s*calc\(100% \+ 18px\);[\s\S]*?\.deck-actions-popover\.open-up\s*\{[^}]*bottom:\s*calc\(100% \+ 18px\);/s,
    );
  });
});
