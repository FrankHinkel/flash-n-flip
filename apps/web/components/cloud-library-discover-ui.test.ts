import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const community = readFileSync(new URL("./community-browser.tsx", import.meta.url), "utf8");
const cloud = readFileSync(new URL("./cloud-deck-browser.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("./cloud-library-sync-setting.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../lib/cloud-library-runtime.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");

describe("Discover iCloud deck management", () => {
  it("provides accessible curated and iCloud tabs", () => {
    expect(community).toContain('role="tablist"');
    expect(community).toContain('role="tab"');
    expect(community).toContain('aria-selected={source === "icloud"}');
    expect(community).toContain("Meine iCloud");
  });
  it("uses the durable cloud commands for local removal, download and global deletion", () => {
    expect(cloud).toContain('kind: "restore"');
    expect(cloud).toContain('command: "remove"');
    expect(cloud).toContain('command: "deck"');
    expect(cloud).toContain("Aus iCloud und von allen Geraeten loeschen");
    expect(cloud).toContain("!deck.curated");
    expect(cloud).toContain('kind: "command-all"');
    expect(cloud).toContain("Alle Konflikte: lokal behalten");
    expect(cloud).toContain("Alle Konflikte: iCloud-Fassung 1");
    expect(cloud).toContain("ALLE LOESCHEN");
    expect(cloud).toContain("runCloudUserAction");
    expect(cloud).toContain("Laden und oeffnen");
  });
  it("keeps a textual account state and 44px tab/action targets", () => {
    expect(settings).toContain('data-state={view.accountStatus}');
    expect(settings).toContain("Bei Apple und iCloud angemeldet");
    expect(styles).toMatch(/\.discover-source-tabs button\s*\{[^}]*min-height:\s*44px/s);
    expect(styles).toMatch(/\.cloud-deck-actions \.button\s*\{[^}]*min-height:\s*44px/s);
  });
  it("lets the development reset stop a running synchronization before deletion", () => {
    expect(settings).toContain("disabled={view.stopping || resetting || !view.account}");
    expect(settings).toContain("Entwicklungsdaten werden geloescht");
    expect(settings).toContain('replaceAll("Ö", "OE")');
    expect(settings).toContain("Lokale Daten wurden nicht geloescht");
    expect(runtime).toMatch(/async function resetDevelopmentFlashNFlipData[\s\S]*?if \(inFlight \|\| pausing\) await pauseCloudSync\(\);/);
  });
  it("publishes discovered decks incrementally and does not repeat every completed full scan", () => {
    expect(runtime).toContain("onDeck: deck =>");
    expect(runtime).toContain("publish({ decks: [...decks, deck] })");
    expect(runtime).not.toContain("scheduleCloudSync(60_000)");
    expect(settings).toContain("Gesamtfortschritt der Synchronisierung");
  });
});
