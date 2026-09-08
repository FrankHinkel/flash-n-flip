import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootLayout = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const portableEntry = readFileSync(
  new URL("../portable/entry.tsx", import.meta.url),
  "utf8",
);
const boundary = readFileSync(
  new URL("./product-runtime-boundary.tsx", import.meta.url),
  "utf8",
);
const gate = readFileSync(
  new URL("./pwa-launch-gate.tsx", import.meta.url),
  "utf8",
);
const messages = readFileSync(
  new URL(
    "../../../packages/i18n/src/ui-messages.generated.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("installed PWA launch boundary", () => {
  it("keeps product runtime initialization behind an i18n-aware launch gate", () => {
    expect(rootLayout).toContain("<ProductRuntimeBoundary>");
    expect(rootLayout.indexOf("<I18nProvider>")).toBeLessThan(
      rootLayout.indexOf("<ProductRuntimeBoundary>"),
    );
    expect(boundary).toContain("<PwaLaunchGate>{children}</PwaLaunchGate>");
    expect(gate).toContain("<Brand");
    expect(portableEntry).not.toContain("<ProductRuntimeBoundary>");
  });

  it("provides visible instructions without a browser bypass", () => {
    const localizedBoundary = `${gate}\n${messages}`;
    expect(localizedBoundary).toContain("Installierte App erforderlich");
    expect(localizedBoundary).toContain("Zum Home-Bildschirm");
    expect(localizedBoundary).toContain("Zum Dock hinzufügen");
    expect(localizedBoundary).not.toContain("Im Browser fortfahren");
  });
});
