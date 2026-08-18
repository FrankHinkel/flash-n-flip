import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const panel = readFileSync(
  new URL("./continue-learning-panel.tsx", import.meta.url),
  "utf8",
);

describe("continued study completion controls", () => {
  it("uses a labelled fieldset with four independent checkboxes", () => {
    expect(panel).toContain('className="continue-learning-panel"');
    expect(panel).toContain("<fieldset>");
    expect(panel).toContain('type="checkbox"');
    expect(panel).toContain("checked={ratings.includes(rating)}");
    expect(panel).toContain("counts[rating]");
  });

  it("keeps touch targets and focus indicators visible", () => {
    expect(styles).toMatch(
      /\.continue-rating-options label\s*\{[^}]*min-height:\s*48px;[^}]*border:\s*1px solid var\(--control-border-strong\);/s,
    );
    expect(styles).toMatch(
      /\.continue-rating-options label:has\(input:focus-visible\)\s*\{[^}]*outline:\s*2px solid var\(--focus\);[^}]*outline-offset:\s*2px;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.continue-rating-options\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s,
    );
  });

  it("offers four Memory pairs by default on every viewport", () => {
    expect(panel).toContain("const preferredMemoryPairs = 4");
    expect(panel).not.toContain("matchMedia");
    expect(panel).toContain("memoryPairCount >= preferredMemoryPairs ? 4 : 0");
  });
});
