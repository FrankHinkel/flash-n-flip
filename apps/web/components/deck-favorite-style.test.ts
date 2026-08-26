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
    expect(component).toContain(
      'referenceDeck ? "deck.browse" : "deck.studyNow"',
    );
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

  it("uses a content-height divider in the existing toggle/content boundary", () => {
    expect(styles).toMatch(
      /\.deck-tree-row::after\s*\{[^}]*top:\s*5px;[^}]*bottom:\s*5px;[^}]*left:\s*calc\(12px \+ var\(--tree-indent\) \+ 35\.5px\);[^}]*width:\s*4px;[^}]*background:\s*color-mix\(in srgb, var\(--ink\) 46%, var\(--border\)\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.deck-tree-row::after\s*\{[^}]*left:\s*calc\(7px \+ var\(--tree-indent\) \+ 35\.5px\);/s,
    );
    expect(styles).not.toMatch(/\.deck-tree-row::after\s*\{[^}]*right:/s);
  });

  it("aligns deck icons with the title while descriptions use the full width", () => {
    expect(component).toContain(
      'className="deck-title-block deck-title-block-stacked"',
    );
    expect(component).toContain('className="deck-title-heading"');
    expect(component).toContain('className="deck-title-description"');
    expect(styles).toMatch(
      /\.deck-title-block-stacked\s*\{[^}]*display:\s*block;/s,
    );
    expect(styles).toMatch(
      /\.deck-title-heading\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s,
    );
  });

  it("uses left-shifted square state icons in a full-height hierarchy toggle", () => {
    expect(component).toContain('<SquareMinus aria-hidden="true"');
    expect(component).toContain('<SquarePlus aria-hidden="true"');
    expect(component).not.toContain("FolderOpen");
    expect(component).not.toContain("FolderClosed");
    expect(styles).toMatch(
      /\.tree-toggle\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*44px;[^}]*align-self:\s*stretch;[^}]*\}[\s\S]*?\.tree-toggle svg\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px;[^}]*transform:\s*translateX\(-3px\);/s,
    );
    expect(styles).toContain(
      "padding: 5px 12px 5px calc(12px + var(--tree-indent));",
    );
    expect(styles).toMatch(
      /\.deck-tree-row::after\s*\{[^}]*top:\s*5px;[^}]*bottom:\s*5px;/s,
    );
  });

  it("carries the selected cap color into row text", () => {
    expect(component).toContain('"learning-active"');
    expect(styles).toMatch(
      /\.deck-tree-row\.learning-active \.deck-tree-main,[\s\S]*?\.deck-tree-row\.learning-active \.deck-summary-metrics\s*\{[^}]*color:\s*var\(--focus\);/s,
    );
  });

  it("uses a speech bubble, one compact menu column and selected Plan text", () => {
    expect(component).toContain('<MessagesSquare aria-hidden="true"');
    expect(component).toContain('<Earth aria-hidden="true"');
    expect(styles).toMatch(
      /\.deck-inline-visual,[\s\S]*?\.deck-inline-direction\s*\{[^}]*width:\s*30px;[^}]*background:\s*transparent;[^}]*border-radius:\s*0;/s,
    );
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
