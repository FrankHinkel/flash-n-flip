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
const study = readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("device connection UI", () => {
  it("uses the requested Lucide status vocabulary globally and explains it in settings", () => {
    expect(component).toMatch(/\bUnplug\b/);
    expect(component).toMatch(/\bNetwork\b/);
    expect(component).toMatch(/\bGlobe\b/);
    expect(provider).toContain("DeviceConnectionIndicator");
    expect(provider).toContain("data-device-connection-status={status}");
    expect(component).toContain('role="status"');
    expect(component).toContain(
      '"VPS verbunden; direkte Übertragung im lokalen Netzwerk."',
    );
    expect(component).toContain(
      '"Weder der VPS noch ein anderes Gerät ist verbunden."',
    );
  });

  it("shows direct status only for an opened peer transport", () => {
    expect(component).toContain("resolveDeviceConnectionStatus({");
    expect(component).toContain("directConnected,");
    expect(provider).toContain('channel?.readyState === "open"');
  });

  it("shows the complete transitive device group with editable local naming", () => {
    expect(component).toContain("trustedDeviceGroupMembers({");
    expect(component).toContain('className="device-name-input"');
    expect(component).toContain('aria-label={text("Edit device name"');
    expect(component).toContain('document.addEventListener("visibilitychange"');
    expect(component).not.toContain('<small>{text("This device"');
    expect(component).not.toContain(
      '? text("Directly connected", "Direkt verbunden")\n                      : text("Paired via VPS", "Über VPS gekoppelt")\n                  </small>',
    );
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

  it("replaces the inconsistent study exit control with the global connection indicator", () => {
    expect(study).not.toContain(
      'aria-label={text("End study", "Lernen beenden")}',
    );
    expect(styles).toMatch(
      /body:has\(\.study-layout\) \.device-connection-indicator\s*\{[^}]*left:\s*max\(10px,/s,
    );
    expect(styles).not.toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.theme-toggle\.study-theme-toggle\s*\{[^}]*display:\s*none/,
    );
  });
});
