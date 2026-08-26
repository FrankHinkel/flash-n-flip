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
      /\.study-answer-question\s*\{[^}]*width:\s*100%;[^}]*margin:\s*0;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 1100px\)[\s\S]*?\.study-answer-question\s*\{[^}]*width:\s*100%;[^}]*margin:\s*0;/,
    );
  });
});
