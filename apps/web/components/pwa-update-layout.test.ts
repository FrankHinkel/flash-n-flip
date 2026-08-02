import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);
const provider = readFileSync(
  new URL("./pwa-update-provider.tsx", import.meta.url),
  "utf8",
);
const shell = readFileSync(new URL("./app-shell.tsx", import.meta.url), "utf8");
const settings = readFileSync(
  new URL("./pwa-update-settings.tsx", import.meta.url),
  "utf8",
);

describe("PWA update layout", () => {
  it("keeps the notice in the scrollable application flow", () => {
    expect(shell).toContain("<PwaUpdateBanner />");
    expect(styles).toMatch(
      /\.pwa-update-banner\s*\{[^}]*display:\s*flex;[^}]*gap:\s*16px;/s,
    );
    expect(styles).not.toMatch(
      /\.pwa-update-banner\s*\{[^}]*position:\s*(?:fixed|absolute|sticky);/s,
    );
  });

  it("uses full-width controls instead of collisions on narrow screens", () => {
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.pwa-update-banner\s*\{[^}]*flex-direction:\s*column;/,
    );
    expect(styles).toMatch(
      /\.pwa-update-settings \.setting-row\s*\{[^}]*flex-direction:\s*column;/,
    );
    expect(styles).toMatch(
      /\.pwa-update-settings-button\s*\{[^}]*min-height:\s*44px;/s,
    );
  });

  it("only offers the global action on explicitly safe routes", () => {
    expect(provider).toContain("!canApply");
    expect(provider).toContain('pathname === "/app/settings"');
    expect(provider).toContain('role="status"');
    expect(provider).toContain('aria-live="polite"');
  });

  it("shows the installed version and a semantic local build time", () => {
    expect(settings).toContain("NEXT_PUBLIC_FNF_APP_VERSION");
    expect(settings).toContain("NEXT_PUBLIC_FNF_WEB_BUILD_TIME");
    expect(settings).toContain("formatAppBuildTime(buildTime, locale)");
    expect(settings).toContain("<time dateTime={buildTime}>");
    expect(styles).toMatch(
      /\.pwa-update-build\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });
});
