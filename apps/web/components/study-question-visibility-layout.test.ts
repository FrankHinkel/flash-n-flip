import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("study question visibility control", () => {
  it("keeps the icon frameless with an accessible touch target", () => {
    expect(styles).toMatch(
      /\.study-question-visibility-toggle\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*background:\s*transparent;[^}]*border:\s*0;/s,
    );
  });

  it("shows an outline only for keyboard focus", () => {
    expect(styles).not.toMatch(
      /\.study-question-visibility-toggle:hover\s*,\s*\.study-question-visibility-toggle:focus-visible/,
    );
    expect(styles).toMatch(
      /\.study-question-visibility-toggle:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\);/s,
    );
  });

  it("keeps the colored question flush and full width at every viewport", () => {
    expect(styles).toMatch(
      /\.study-answer-question\s*\{[^}]*width:\s*calc\(100% \+ 2 \* var\(--study-card-padding\)\);[^}]*margin:\s*calc\(-1 \* var\(--study-card-padding\)\)[^}]*border:\s*0;/s,
    );
  });

  it("removes the hidden question from layout while keeping the eye overlaid", () => {
    expect(styles).toMatch(
      /\.study-answer-stack\.question-collapsed\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.study-question-visibility-toggle\s*\{[^}]*position:\s*absolute;[^}]*top:\s*0;[^}]*right:\s*0;/s,
    );
  });
});
