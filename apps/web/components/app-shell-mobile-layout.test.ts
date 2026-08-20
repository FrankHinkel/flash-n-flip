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
      /--mobile-nav-bottom-offset:\s*max\([\s\S]*?calc\(var\(--safe-area-bottom\) - 10px\)[\s\S]*?\);/,
    );
    expect(styles).toMatch(
      /\.mobile-nav\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*var\(--mobile-nav-bottom-offset\);/s,
    );
  });

  it("uses the Flash-n-Flip mark without an overview caption on mobile", () => {
    expect(shell).toContain("brandMark: true");
    expect(shell).toContain("aria-label={brandMark ? label : undefined}");
    expect(shell).toContain('<BrandMark className="mobile-overview-mark" />');
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain('label: "Decks"');
    expect(shell).toContain('text("Local", "Lokal")');
    expect(shell).not.toContain('text("Local device", "Lokales Gerät")');
    expect(shell).toContain("directConnectionStateEvent");
    expect(shell).not.toContain("startLocalAudioOptimization");
    expect(shell).not.toContain("resumeAudio");
    expect(shell).toContain('"connection-cog connection-cog-connected"');
    expect(shell).toContain('connectionState === "transport-connected"');
    expect(shell).toContain('connectionState === "syncing"');
    expect(shell).toContain("Gerät verbunden");
  });

  it("colors only the settings cog when a direct device is connected", () => {
    expect(styles).toMatch(
      /\.connection-cog-connected,[^{]*data-direct-connection-state="transport-connected"[^{]*data-direct-connection-state="syncing"[^{]*data-direct-connection-state="synced"[^}]*color:\s*var\(--connected-cog\) !important;[^}]*filter:\s*none !important;/s,
    );
    expect(styles).toContain("--connected-cog: #137333;");
    expect(styles).toContain("--connected-cog: #4ade80;");
    expect(styles).not.toMatch(
      /\.(?:sidebar-account-link|study-rail-settings|mobile-nav)[^{]*connection-cog-connected[^}]*background:/s,
    );
  });

  it("aligns regular views with the compact study top edge", () => {
    expect(styles).toMatch(
      /\.theme-toggle,[\s\S]*?\.device-connection-indicator\s*\{[^}]*top:\s*max\(10px, calc\(var\(--safe-area-top\) \+ 6px\)\);/,
    );
    expect(styles).toMatch(
      /\.theme-toggle\s*\{[^}]*right:\s*max\(22px, calc\(var\(--safe-area-right\) \+ 18px\)\);/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.app-content\s*\{[^}]*padding-top:\s*var\(--safe-area-top\);/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.theme-toggle,[\s\S]*?\.device-connection-indicator\s*\{[^}]*top:\s*max\(3px, var\(--safe-area-top\)\);/,
    );
    expect(styles).toMatch(
      /\.device-connection-indicator\s*\{[^}]*left:\s*max\(22px, calc\(var\(--safe-area-left\) \+ 18px\)\);/s,
    );
    expect(styles).toMatch(
      /\.theme-toggle\.study-theme-toggle\s*\{[^}]*right:\s*max\(10px, calc\(var\(--safe-area-right\) \+ 6px\)\);/s,
    );
    expect(styles).toMatch(
      /\.theme-toggle:focus-visible\s*\{[^}]*outline-offset:\s*0;/,
    );
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

  it("keeps compact icon navigation available in study and editor modes", () => {
    expect(shell).toContain('<aside className="study-rail">');
    expect(shell).toContain('className="study-rail-tooltip"');
    expect(styles).toMatch(
      /\.app-layout\.compact-layout\s*\{[^}]*grid-template-columns:\s*64px minmax\(0, 1fr\);/s,
    );
    expect(styles).toMatch(
      /\.study-rail a\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.study-rail\s*\{[^}]*display:\s*none;/,
    );
  });

  it("marks fixed-height native workspaces separately from scrolling pages", () => {
    expect(shell).toContain(
      'const usesFixedViewport = usesCompactRail || pathname === "/app/memory"',
    );
    expect(shell).toContain(
      '${usesFixedViewport ? " fixed-viewport-layout" : ""}',
    );
  });
});
