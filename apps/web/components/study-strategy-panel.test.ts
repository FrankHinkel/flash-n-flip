import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./study-strategy-panel.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const dashboard = readFileSync(
  new URL("./dashboard.tsx", import.meta.url),
  "utf8",
);

describe("plan-specific study strategy panel", () => {
  it("uses the agreed icons and exposes pace in text and meter semantics", () => {
    expect(source).toContain("BALANCED: Scale");
    expect(source).not.toContain("Lightbulb");
    expect(source).toContain("LONG_TERM: TreePine");
    expect(source).toContain("EXAM: CalendarCheck");
    expect(source).toContain("OVERVIEW: Binoculars");
    expect(source).toContain('role="meter"');
    expect(source).toContain("aria-valuetext={paceLabel}");
    expect(source).toContain("aria-expanded={paceExpanded}");
    expect(source).toContain("projectStudyPace({");
    expect(source).toContain("strategy: draft");
    expect(source).toContain("— nicht gespeichert");
    expect(source).toContain("<Turtle");
    expect(source).toContain("<Rabbit");
    expect(source).toContain("{paceLabel}");
    expect(source).toContain("planning budget");
    expect(source).toContain("Planungsbudget");
    expect(source).toContain('className="study-strategy-icon"');
    expect(source).toContain('role="img"');
    expect(source).toContain("title={strategyDescription}");
    expect(source).not.toContain(
      '<small>{text("Strategy", "Strategie")}</small>',
    );
  });

  it("selects the active learning plan from the compact strategy row", () => {
    expect(source).toContain("listLocalNamedStudyPlans");
    expect(source).toContain("setActiveLocalNamedStudyPlan(planId)");
    expect(source).toContain('className="study-plan-selector"');
    expect(source).toContain('text("Learning plan", "Lernplan")');
    expect(styles).toMatch(
      /\.study-plan-selector select\s*\{[^}]*min-height:\s*44px;[^}]*text-overflow:\s*ellipsis;/s,
    );
    expect(styles).toMatch(
      /:root\[data-resolved-theme="dark"\] \.study-strategy-icon\s*\{[^}]*color:\s*var\(--accent-text\);/s,
    );
  });

  it("keeps all controls touch-sized and stacks the panel on narrow screens", () => {
    expect(styles).toMatch(
      /\.study-strategy-settings summary\s*\{[^}]*min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.study-strategy-fields input,[\s\S]*?min-height:\s*44px;/,
    );
    expect(styles).toMatch(
      /\.study-pace-summary\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s,
    );
  });

  it("keeps details hidden until the pace bar is expanded", () => {
    expect(source).toContain("{paceExpanded ? (");
    expect(source).toContain("hidden={!paceExpanded}");
    expect(source).toContain("Show learning pace details");
    expect(source).toContain("Lerntempo-Details anzeigen");
  });

  it("states that preset reset preserves FSRS due dates and review history", () => {
    expect(source).toContain("existing FSRS due dates remain unchanged");
    expect(source).toContain("Wiederholungsverlauf");
  });

  it("does not call a day complete while difficult reviews remain due", () => {
    expect(dashboard).toContain(
      "difficult reviews remain due outside today's strategy",
    );
    expect(dashboard).toContain("schwierige Wiederholungen bleiben außerhalb");
    expect(dashboard).toContain("todayCount === 0 && deferredReviews === 0");
  });

  it("offers the remembered learning context from the overview", () => {
    expect(dashboard).toContain("lastStudyHrefKey");
    expect(dashboard).toContain("continueStudyHrefForLearningPlan(");
    expect(dashboard).toContain(
      "(todayCount !== null && todayCount > 0) || continueStudyHref",
    );
    expect(dashboard).toContain('text("Continue studying", "Weiterlernen")');
    expect(dashboard).toContain("href={continueStudyHref}");
    expect(styles).toMatch(
      /\.today-card-continue\s*\{[^}]*color:\s*#fff;[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.78\);/s,
    );
    expect(styles).toMatch(
      /\.today-card-continue:focus-visible\s*\{[^}]*outline:\s*3px solid #fff;[^}]*outline-offset:\s*3px;/s,
    );
  });

  it("removes the salutation while keeping desktop type sizes unchanged", () => {
    expect(dashboard).not.toContain('{text("Hello", "Hallo")}');
    expect(styles).toMatch(
      /\.today-card h2\s*\{[^}]*font:\s*550 34px\/1\.1 var\(--font-display\);/s,
    );
    expect(styles).toMatch(
      /\.continue-learning-heading-row h2\s*\{[^}]*font:\s*600 clamp\(30px, 3vw, 38px\) \/ 1\.08 var\(--font-display\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.continue-learning-heading-row h2\s*\{[^}]*font-size:\s*26px;[\s\S]*?\.today-card h2\s*\{[^}]*font-size:\s*32px;/s,
    );
  });
});
