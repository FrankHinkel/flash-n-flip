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
  it("uses the deck body as the selection control and keeps the cap decorative", () => {
    expect(component).toContain('className="deck-tree-main"');
    expect(component).toContain("aria-pressed={Boolean(deck.learningEnabled)}");
    expect(component).toContain('className="deck-title-learning-icon"');
    expect(component).not.toContain("learning-plan-button");
    expect(styles).toMatch(
      /\.deck-title-learning-icon\s*\{[^}]*color:\s*var\(--focus\);[^}]*stroke-width:\s*2\.75;/s,
    );
  });

  it("keeps the menu state-driven and exposes direct study only in the menu", () => {
    expect(component).toContain('<EllipsisVertical aria-hidden="true"');
    expect(component).toContain("aria-expanded={openMenuId === deck.id}");
    expect(component).toContain('<Play aria-hidden="true"');
    expect(component).toContain('{text("Study now", "Jetzt üben")}');
    expect(component).toContain(
      "window.innerHeight - trigger.getBoundingClientRect().bottom < 360",
    );
    expect(styles).toMatch(
      /\.deck-menu-trigger\[aria-expanded="true"\]\s*\{[^}]*color:\s*var\(--focus\);[^}]*background:\s*transparent;[^}]*outline:\s*0;/,
    );
    expect(styles).not.toContain(".deck-menu-trigger:hover");
    expect(styles).toMatch(
      /\.deck-menu-trigger:focus-visible\s*\{[^}]*outline:\s*0;/s,
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

  it("uses a speech bubble, one compact menu column and selected Plan text", () => {
    expect(component).toContain('<MessageCircle aria-hidden="true"');
    expect(styles).toMatch(
      /\.deck-row-actions\s*\{[^}]*width:\s*44px;[^}]*align-self:\s*stretch;[^}]*position:\s*relative;/s,
    );
    expect(styles).toMatch(
      /\.deck-actions-popover\s*\{[^}]*top:\s*calc\(100% \+ 4px\);[\s\S]*?\.deck-actions-popover\.open-up\s*\{[^}]*bottom:\s*calc\(100% \+ 4px\);/s,
    );
    expect(styles).toMatch(
      /\.named-study-plan-bar label\s*\{[^}]*color:\s*var\(--focus\);[\s\S]*?\.named-study-plan-bar select\s*\{[^}]*color:\s*var\(--focus\);/s,
    );
  });

  it("places inventory below plan progress and omits empty plan bars", () => {
    expect(component).toContain(
      "!studyPlanProgress.pending && studyPlanProgress.total > 0",
    );
    expect(component).toContain('className="deck-summary-line"');
    expect(component).toContain('className="deck-plan-progress-stat"');
    expect(styles).toMatch(
      /\.deck-summary-line\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;/s,
    );
    expect(styles).toMatch(
      /\.deck-plan-progress-stat\s*\{[^}]*color:\s*var\(--focus\);/s,
    );
  });
});
