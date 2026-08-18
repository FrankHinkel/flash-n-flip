import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./deck-list.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("compact named study plan controls", () => {
  it("keeps only the selector and a three-dot menu in the plan bar", () => {
    const planBar = source.slice(
      source.indexOf('className="named-study-plan-bar"'),
      source.indexOf('<div className="deck-filter-row">'),
    );
    expect(planBar).toContain("<EllipsisVertical");
    expect(planBar).toContain('aria-haspopup="menu"');
    expect(planBar).toContain('role="menu"');
    expect(planBar).not.toContain("Due and new cards are limited");
    expect(planBar).not.toContain("Fällige und neue Karten werden");
  });

  it("offers four labelled icon-only actions with 44px targets", () => {
    const planBar = source.slice(
      source.indexOf('className="named-study-plan-bar"'),
      source.indexOf('<div className="deck-filter-row">'),
    );
    expect(planBar).toContain("<Plus");
    expect(planBar).toContain("<Pencil");
    expect(planBar).toContain("<RotateCcw");
    expect(planBar).toContain("<Trash2");
    expect(planBar.match(/role="menuitem"/g)).toHaveLength(4);
    expect(planBar.match(/className="sr-only"/g)).toHaveLength(4);
    expect(source).toContain('[role="menuitem"]:not([disabled])');
    expect(styles).toMatch(
      /\.deck-actions-popover\.named-study-plan-actions-popover button\s*\{[^}]*width:\s*44px;/s,
    );
  });
});
