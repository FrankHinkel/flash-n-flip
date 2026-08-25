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
    expect(styles).toMatch(
      /\.mobile-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4, 1fr\);/s,
    );
  });

  it("uses the Flash-n-Flip mark without an overview caption on mobile", () => {
    expect(shell).toContain("brandMark: true");
    expect(shell).toContain("aria-label={brandMark ? label : undefined}");
    expect(shell).toContain('<BrandMark className="mobile-overview-mark" />');
    expect(shell).toContain('aria-current={isActive ? "page" : undefined}');
    expect(shell).toContain('label: "Decks"');
    expect(shell).not.toContain('label: text("Study", "Lernen")');
    expect(shell).toContain("lastStudyHrefKey");
    expect(shell).toContain("studyHrefToRemember");
    expect(shell).toContain('useRef<NativeTabId>("overview")');
    expect(shell).toContain("contextualLearningRoute");
    expect(shell).toContain(
      "nativeHrefForTab(request.tabId, rememberedStudyHref)",
    );
    expect(shell).toContain('text("Local", "Lokal")');
    expect(shell).not.toContain('text("Local device", "Lokales Gerät")');
    expect(shell).not.toContain("directConnectionStateEvent");
    expect(shell).not.toContain("startLocalAudioOptimization");
    expect(shell).not.toContain("resumeAudio");
    expect(shell).not.toContain("connection-cog-connected");
    expect(shell).not.toContain('connectionState === "transport-connected"');
    expect(shell).not.toContain('connectionState === "syncing"');
    expect(shell).not.toContain("Gerät verbunden");
  });

  it("keeps the local settings cog independent of a server connection", () => {
    expect(shell).toContain('className="connection-cog"');
    expect(shell).not.toContain("directConnected");
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

  it("renders a stable floating surface with grayscale inactive icons", () => {
    const mobileNavRule =
      /\.mobile-nav\s*\{[^}]*position:\s*fixed;[^}]*\}/s.exec(styles)?.[0] ??
      "";
    expect(mobileNavRule).toContain("background: rgb(247, 246, 242);");
    expect(mobileNavRule).toContain("border-radius: 30px;");
    expect(mobileNavRule).not.toContain("backdrop-filter:");
    expect(styles).toMatch(
      /:root\[data-resolved-theme="dark"\] \.mobile-nav\s*\{[^}]*background:\s*rgb\(36, 40, 50\);/s,
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
