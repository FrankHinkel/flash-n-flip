import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const shell = readFileSync(new URL("./app-shell.tsx", import.meta.url), "utf8");

describe("mobile application shell", () => {
  it("keeps document bounce outside the application views", () => {
    expect(styles).toMatch(
      /html\s*\{[^}]*overscroll-behavior:\s*none;[^}]*background:\s*var\(--paper\);/s,
    );
    expect(styles).toMatch(
      /body:has\(\.app-layout\)\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/s,
    );
    expect(styles).toMatch(
      /\.app-layout:not\(\.study-layout\) \.app-content\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*none;/s,
    );
    expect(styles).toMatch(
      /\.mobile-nav\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;/s,
    );
  });

  it("uses the Flash-n-Flip mark without an overview caption on mobile", () => {
    expect(shell).toContain("brandMark: true");
    expect(shell).toContain("aria-label={brandMark ? label : undefined}");
    expect(shell).toContain('<BrandMark className="mobile-overview-mark" />');
    expect(shell).toMatch(
      /brandMark \? \(\s*<BrandMark className="mobile-overview-mark" \/>\s*\) : \(\s*<>[\s\S]*?<span>\{label\}<\/span>/,
    );
  });
});
