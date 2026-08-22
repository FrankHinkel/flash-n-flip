import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const helpStyles = readFileSync(
  new URL("./online-help.module.css", import.meta.url),
  "utf8",
);
const communityBrowser = readFileSync(
  new URL("./community-browser.tsx", import.meta.url),
  "utf8",
);
const deckCatalog = readFileSync(
  new URL("./deck-catalog.tsx", import.meta.url),
  "utf8",
);

describe("application page headers", () => {
  it("centers regular page headers and their actions", () => {
    expect(styles).toMatch(
      /\.app-header\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/s,
    );
    expect(styles).toMatch(
      /\.header-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*center;[^}]*gap:\s*9px;/s,
    );
  });

  it("uses the regular page inset for Discover without a separate hero", () => {
    expect(styles).toMatch(/\.app-page\s*\{[^}]*padding:\s*24px 55px 80px;/s);
    expect(styles).toMatch(
      /\.discover-collections\s*\{[^}]*max-width:\s*none;[^}]*margin:\s*0;[^}]*padding:\s*0;/s,
    );
    expect(communityBrowser).toContain(
      '<main className="app-page discover-page">',
    );
    expect(communityBrowser).not.toContain("community-hero");
    expect(communityBrowser).not.toContain("Curated downloads");
    expect(communityBrowser).not.toContain("Kuratierte Downloads");
    expect(deckCatalog).toContain('<h1 id="discover-collections-title">');
  });

  it("centers the help header as another application view", () => {
    expect(helpStyles).toMatch(
      /\.header\s*\{[^}]*margin:\s*0 auto 24px;[^}]*text-align:\s*center;/s,
    );
    expect(helpStyles).toMatch(/\.header p\s*\{[^}]*margin:\s*12px auto 0;/s);
  });

  it("keeps narrow content clear of the viewport scrollbar", () => {
    expect(styles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.app-page\s*\{[^}]*padding:\s*14px max\(12px, var\(--safe-area-right\)\) 80px\s+max\(12px, var\(--safe-area-left\)\);/,
    );
    expect(styles).toMatch(
      /\.community-results\s*\{[^}]*padding-right:\s*max\(12px, var\(--safe-area-right\)\);[^}]*padding-left:\s*max\(12px, var\(--safe-area-left\)\);/,
    );
  });
});
