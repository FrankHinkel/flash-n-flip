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
const deckList = readFileSync(
  new URL("./deck-list.tsx", import.meta.url),
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

  it("shows all signed-in account devices with editable local naming", () => {
    expect(component).toMatch(
      /result\.devices\.filter\(\s*\(device\) => !device\.revokedAt,?\s*\)/,
    );
    expect(component).toContain('className="device-name-input"');
    expect(component).toContain('aria-label={text("Edit device name"');
    expect(component).toContain('document.addEventListener("visibilitychange"');
    expect(component).toContain(
      '"Deine angemeldeten Geräte finden und verbinden sich automatisch.',
    );
    expect(component).toContain(
      "Bei Direktübertragungen laufen Lernsets und Medien nicht über den VPS.",
    );
    expect(component).not.toContain("Pairing link");
    expect(component).not.toContain("QR code");
    expect(component).not.toContain("Pair device");
  });

  it("registers the local identity and negotiates direct transport automatically", () => {
    expect(provider).toContain("getOrCreateLocalDeviceIdentity()");
    expect(provider).toContain("api.registerDevice({");
    expect(provider).toContain("createAutomaticConnectionSession");
    expect(provider).toContain("getPendingAutomaticConnectionSession");
    expect(provider).toContain("establishPairingPeerConnection({");
    expect(provider).toContain(
      "if (connectionRef.current !== input.connection)",
    );
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
    expect(styles).not.toContain(".manual-pairing");
    expect(styles).not.toContain(".pairing-dialog");
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

  it("keeps device-connect actions out of the Apple-facing deck library", () => {
    expect(deckList).not.toContain("<ScanQrCode");
    expect(deckList).not.toContain("deck-qr-button");
    expect(deckList).not.toContain('href="/connect?source=app"');
  });
});
