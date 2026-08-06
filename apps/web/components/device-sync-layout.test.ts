import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./device-sync-settings.tsx", import.meta.url),
  "utf8",
);
const provider = readFileSync(
  new URL("./device-transport-provider.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("device connection UI", () => {
  it("uses the requested Lucide status vocabulary with visible labels", () => {
    expect(component).toMatch(/\bUnplug\b/);
    expect(component).toMatch(/\bNetwork\b/);
    expect(component).toMatch(/\bGlobe\b/);
    expect(component).toContain('role="status"');
    expect(component).toContain('text("Local · offline", "Lokal · offline")');
    expect(component).toContain(
      'text("Direct · local network", "Direkt · lokales Netzwerk")',
    );
    expect(component).toContain('text("VPS · ready", "VPS · bereit")');
  });

  it("shows direct status only for an opened peer transport", () => {
    expect(component).toContain(": directConnected");
    expect(provider).toContain('channel?.readyState === "open"');
  });

  it("polls pairing sessions from stable primitive dependencies", () => {
    expect(component).toContain("const pairingSessionId = draft?.session.id");
    expect(component).toContain(
      "const pairingConfirmation = draft?.confirmationCode",
    );
    expect(component).not.toMatch(/\}, \[draft,/);
  });

  it("keeps transfer status in document flow and mobile controls touch-sized", () => {
    const bannerRule = styles.match(
      /\.device-transfer-banner\s*\{[^}]+\}/s,
    )?.[0];
    expect(bannerRule).toBeTruthy();
    expect(bannerRule).not.toMatch(/position:\s*(?:fixed|absolute)/);
    expect(styles).toMatch(
      /\.device-transfer-actions \.button,[\s\S]*?min-height:\s*44px/,
    );
    expect(styles).toMatch(
      /\.pairing-dialog \.text-link\s*\{[\s\S]*?min-height:\s*44px/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.device-transfer-banner\s*\{[\s\S]*?grid-template-columns:\s*24px minmax\(0, 1fr\)/,
    );
  });
});
