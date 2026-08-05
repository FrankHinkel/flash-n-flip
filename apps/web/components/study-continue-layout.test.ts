import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const session = readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);

describe("continued study completion controls", () => {
  it("uses a labelled fieldset with four independent checkboxes", () => {
    expect(session).toContain('className="continue-study-panel"');
    expect(session).toContain("<fieldset>");
    expect(session).toContain('type="checkbox"');
    expect(session).toContain(
      "checked={continueRatings.includes(rating.value)}",
    );
    expect(session).toContain("continueCounts[rating.value]");
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
});
