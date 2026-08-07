import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(
  new URL("./universal-qr-scanner.tsx", import.meta.url),
  "utf8",
);
const appShell = readFileSync(
  new URL("./app-shell.tsx", import.meta.url),
  "utf8",
);
const deckList = readFileSync(
  new URL("./deck-list.tsx", import.meta.url),
  "utf8",
);
const settings = readFileSync(
  new URL("./settings.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("universal QR scanner UI", () => {
  it("centralizes incoming links while placing scanner actions only in decks and settings", () => {
    expect(appShell).toContain("<QrScannerProvider />");
    expect(appShell).not.toContain("<QrScannerButton");
    expect(component).toContain("export function QrScannerButton");
    expect(component).toContain("<ScanQrCode");
    expect(component).toContain("decodeFlashNFlipQrAction(");
    expect(component).toContain("<AccountShareDialog");
    expect(deckList).toContain(
      '<QrScannerButton className="button button-quiet deck-qr-button" />',
    );
    expect(settings).toContain(
      '<section className="settings-section qr-scanner-settings">',
    );
    expect(settings).toContain(
      "Geteilte Lernsets empfangen und Flash-n-Flip-Einladungen öffnen.",
    );
    expect(deckList).not.toContain("decodeAccountShareLink");
    expect(deckList).not.toContain("shareInvitation");
    expect(deckList).toMatch(
      /\{\s*directConnected,\s*sendDeck,\s*serverReachable\s*\}/,
    );
    expect(deckList).toMatch(
      /\{serverReachable \? \([\s\S]*?setShareDeck\(deck\)[\s\S]*?\) : null\}/,
    );
  });

  it("requests the rear camera only after interaction and stops every track", () => {
    expect(component).toContain("navigator.mediaDevices.getUserMedia({");
    expect(component).toContain('facingMode: { ideal: "environment" }');
    expect(component).toContain("getTracks().forEach((track) => track.stop())");
    expect(component).toContain("window.cancelAnimationFrame");
    expect(component).toContain("useEffect(() => () => stopCamera()");
  });

  it("keeps keyboard, paste, and small-screen alternatives available", () => {
    expect(component).toContain('role="dialog"');
    expect(component).toContain('aria-modal="true"');
    expect(component).toContain('event.key === "Escape"');
    expect(component).toContain("navigator.clipboard.readText()");
    expect(component).toContain("maxLength={8_192}");
    expect(styles).not.toContain(".universal-qr-trigger");
    expect(styles).toMatch(/\.deck-qr-button\s*\{[^}]*width:\s*44px/s);
    expect(styles).toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.qr-link-form\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 44px/,
    );
  });
});
