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
  it("keeps the page fixed and scrolls long content inside the card", () => {
    expect(session).toContain('"study-reference-card"');
    expect(session).toContain('"study-reference-page"');
    expect(styles).toMatch(
      /\.app-layout\.study-layout\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.study-layout \.app-content\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.study-card-main\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/s,
    );
    expect(styles).toMatch(
      /\.study-reference-card \.study-card-main \.card-content\s*\{[^}]*flex:\s*0 0 auto;[^}]*overflow:\s*visible;/s,
    );
  });

  it("keeps the header and answer controls outside the scroll region", () => {
    expect(styles).toMatch(/\.study-header\s*\{[^}]*flex:\s*0 0 auto;/s);
    expect(styles).toMatch(
      /\.study-card\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(/\.rating-panel\s*\{[^}]*flex:\s*0 0 auto;/s);
    expect(styles).toMatch(
      /\.study-layout \.study-page\s*\{[^}]*height:\s*calc\(100dvh - 73px - var\(--safe-area-bottom\)\);[^}]*padding-top:\s*max\(3px, var\(--safe-area-top\)\);/s,
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

  it("keeps reference paging controls large and responsive", () => {
    expect(styles).toMatch(
      /\.study-reference-navigation\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(styles).toMatch(
      /\.study-reference-navigation button\s*\{[^}]*min-height:\s*48px;[^}]*background:\s*var\(--surface\);[^}]*border:\s*2px solid var\(--control-border-strong\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 390px\)[\s\S]*?\.study-reference-navigation\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/,
    );
  });
});
