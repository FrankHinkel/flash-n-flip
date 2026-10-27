import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uiMessageKey } from "./i18n-test-helpers";

const source = readFileSync(
  new URL("./deck-list.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("compact named study plan controls", () => {
  it("opens explicit plan editing without a lock or hidden row-selection mode", () => {
    expect(source).not.toContain("learningPlanUnlocked");
    expect(source).not.toContain("<Lock");
    expect(source).toContain("<StudyPlanDeckSelection");
    expect(source).toContain('text("ui.editPlan")');
    expect(source).toContain("href={deckHref}");
    expect(source).not.toContain("toggleLearningPlan(deck)");
  });

  it("marks browse-only reference decks with a labelled book icon", () => {
    expect(source).toContain("BookOpenText");
    expect(source).toContain('className="deck-title-reference-icon"');
    expect(source).toContain('? "deck.browseReference"');
  });

  it("offers four visibly labelled actions in the standard deck menu layout", () => {
    const planBar = source.slice(
      source.indexOf('className="named-study-plan-bar"'),
      source.indexOf('<div className="deck-filter-row">'),
    );
    expect(planBar).toContain("<Plus");
    expect(planBar).toContain("<Pencil");
    expect(planBar).toContain("<RotateCcw");
    expect(planBar).toContain("<Trash2");
    expect(planBar.match(/role="menuitem"/g)).toHaveLength(4);
    expect(planBar).toContain(
      `text("${uiMessageKey("New plan", "Neuer Plan")}")`,
    );
    expect(planBar).toContain(
      `text("${uiMessageKey("Rename plan", "Plan umbenennen")}")`,
    );
    expect(planBar).toContain(
      `text("${uiMessageKey("Reset progress", "Fortschritt zurücksetzen")}")`,
    );
    expect(planBar).toContain(
      `text("${uiMessageKey("Delete plan", "Plan löschen")}")`,
    );
    expect(planBar).not.toContain('className="sr-only"');
    expect(source).toContain('[role="menuitem"]:not([disabled])');
    expect(styles).not.toContain(
      ".deck-actions-popover.named-study-plan-actions-popover button",
    );
    expect(styles).toMatch(
      /\.deck-actions-popover a,\s*\.deck-actions-popover button\s*\{[^}]*min-height:\s*44px;[^}]*padding:\s*8px 11px;[^}]*display:\s*flex;[^}]*gap:\s*10px;/s,
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
