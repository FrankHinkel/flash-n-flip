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
  it("keeps the selector, card progress, menu, and selection lock in the plan bar", () => {
    const planBar = source.slice(
      source.indexOf('className="named-study-plan-bar"'),
      source.indexOf('<div className="deck-filter-row">'),
    );
    expect(planBar).toContain("<EllipsisVertical");
    expect(planBar).toContain("<LockOpen");
    expect(planBar).toContain("<Lock");
    expect(planBar).toContain("learningPlanUnlocked");
    expect(planBar).toContain("aria-pressed={learningPlanUnlocked}");
    expect(planBar).toContain('aria-haspopup="menu"');
    expect(planBar).toContain('role="menu"');
    expect(planBar).toContain('{text("Plan", "Plan")}');
    expect(planBar).toContain('className="named-study-plan-progress"');
    expect(planBar).toContain("activeStudyPlanProgress.total");
    expect(planBar).toContain("activeStudyPlanProgress.reviewed");
    expect(planBar).toContain("bearbeitet");
    expect(planBar).not.toContain("Active learning plan");
    expect(planBar).not.toContain("Aktiver Lernplan");
    expect(planBar).not.toContain("Due and new cards are limited");
    expect(planBar).not.toContain("Fällige und neue Karten werden");
    const selector = planBar.slice(
      planBar.indexOf('className="named-study-plan-selector"'),
      planBar.indexOf('className="named-study-plan-progress"'),
    );
    expect(selector).toContain('id="active-study-plan"');
    expect(selector).toContain("className={`named-study-plan-lock");
    expect(planBar.indexOf("named-study-plan-lock")).toBeLessThan(
      planBar.indexOf("named-study-plan-menu"),
    );
  });

  it("studies a deck while locked and edits the plan only while unlocked", () => {
    expect(source).toContain(") : learningPlanUnlocked && !referenceDeck ? (");
    expect(source).toContain("onClick={() => void toggleLearningPlan(deck)}");
    expect(source).toContain("href={deckHref}");
    expect(source).toContain("`Study ${displayTitle}`");
    expect(source).toContain("`${displayTitle} lernen`");
    expect(source).toContain("setLearningPlanUnlocked(false);");
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

  it("keeps the lock inside the selector, the menu beside it, and progress below on narrow screens", () => {
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.named-study-plan-progress\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.named-study-plan-menu\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s,
    );
    expect(styles).toMatch(
      /\.named-study-plan-selector\s*\{[^}]*grid-template-columns:\s*auto minmax\(140px, 320px\) auto;/s,
    );
    expect(styles).toMatch(
      /\.named-study-plan-lock\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s,
    );
  });
});
