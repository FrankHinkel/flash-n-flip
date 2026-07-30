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

describe("study reference card layout", () => {
  it("marks developer references and makes their content vertically scrollable", () => {
    expect(session).toContain('"study-reference-card"');
    expect(styles).toMatch(
      /\.study-reference-card \.study-card-main \.card-content\s*\{[^}]*overflow-y:\s*auto;/s,
    );
  });

  it("keeps formulas from shrinking and removes optional headings on compact screens", () => {
    expect(styles).toMatch(
      /\.study-reference-card \.math-block,[\s\S]*?flex:\s*0 0 auto;/,
    );
    expect(styles).toMatch(
      /\.study-reference-card\[data-study-card="answer"\][\s\S]*?> h2:first-of-type,[\s\S]*?> h3:first-of-type\s*\{[^}]*display:\s*none;/,
    );
  });

  it("uses a strong border for the practice next action", () => {
    expect(styles).toMatch(
      /\.rating-panel \.practice-next-row button\s*\{[^}]*border:\s*2px solid var\(--control-border-strong\);/,
    );
  });
});
