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
    expect(source).toContain("BALANCED: Lightbulb");
    expect(source).toContain("LONG_TERM: TreePine");
    expect(source).toContain("EXAM: CalendarCheck");
    expect(source).toContain("OVERVIEW: Binoculars");
    expect(source).toContain('role="meter"');
    expect(source).toContain("aria-valuetext={paceLabel}");
    expect(source).toContain("<Turtle");
    expect(source).toContain("<Rabbit");
    expect(source).toContain("{paceLabel}");
    expect(source).toContain("planning budget");
    expect(source).toContain("Planungsbudget");
  });

  it("keeps all controls touch-sized and stacks the panel on narrow screens", () => {
    expect(styles).toMatch(
      /\.study-strategy-settings summary\s*\{[^}]*min-height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /\.study-strategy-fields input,[\s\S]*?min-height:\s*44px;/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.study-pace-summary,[\s\S]*?\.study-strategy-fields\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
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
});
