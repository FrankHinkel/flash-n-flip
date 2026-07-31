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
  it("lets long developer references grow the study page", () => {
    expect(session).toContain('"study-reference-card"');
    expect(session).toContain('"study-reference-page"');
    expect(styles).toMatch(
      /\.app-layout\.study-layout:has\(\.study-reference-page\)\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100dvh;[^}]*overflow:\s*visible;/s,
    );
    expect(styles).toMatch(
      /\.study-layout \.study-page\.study-reference-page\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100dvh;[^}]*overflow:\s*visible;/s,
    );
    expect(styles).toMatch(
      /\.study-reference-card \.study-card-main \.card-content\s*\{[^}]*overflow:\s*visible;/s,
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
