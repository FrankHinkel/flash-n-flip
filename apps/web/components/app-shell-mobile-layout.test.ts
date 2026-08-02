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
      /\.mobile-nav\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*max\(8px, var\(--safe-area-bottom\)\);/s,
    );
  });

  it("uses the Flash-n-Flip mark without an overview caption on mobile", () => {
    expect(shell).toContain("brandMark: true");
    expect(shell).toContain("aria-label={brandMark ? label : undefined}");
    expect(shell).toContain('<BrandMark className="mobile-overview-mark" />');
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
  });

  it("renders a floating glass surface with grayscale inactive icons", () => {
    expect(styles).toMatch(
      /\.mobile-nav\s*\{[^}]*border-radius:\s*30px;[^}]*-webkit-backdrop-filter:\s*blur\(24px\) saturate\(175%\);[^}]*backdrop-filter:\s*blur\(24px\) saturate\(175%\);/s,
    );
    expect(styles).toMatch(
      /\.mobile-nav a:not\(\.active\) > svg,[\s\S]*?\.mobile-nav a:not\(\.active\) \.brand-mark img\s*\{[^}]*filter:\s*grayscale\(1\) saturate\(0\);/,
    );
    expect(styles).toMatch(
      /\.mobile-nav a\.active::before,[\s\S]*?opacity:\s*1;[^}]*transform:\s*scale\(1\);/,
    );
  });
});
