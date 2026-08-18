import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const legalDocument = read("./legal-document.tsx");
const settings = read("./settings.tsx");
const launchGate = read("./pwa-launch-gate.tsx");
const connect = read("../public/connect/index.html");
const connectSource = read(
  "../../../packages/direct-connect-webstack/static/index.html",
);
const imprint = read("../../../docs/legal/imprint.md");
const privacy = read("../../../docs/legal/privacy.de.md");
const dataMap = read("../../../docs/legal/data-map.md");
const openItems = read("../../../docs/legal/open-items.md");

const legalRoutes = ["/legal/imprint", "/legal/privacy", "/legal/terms"];

describe("public legal surface", () => {
  it("identifies the real operator, contact, host, and server location", () => {
    for (const source of [legalDocument, imprint, privacy]) {
      expect(source).toContain("Frank Hinkel");
      expect(source).toContain("Friedenstr. 39");
      expect(source).toContain("67292 Kirchheimbolanden");
      expect(source).toContain("flash-n-flip@hi-sys.de");
      expect(source).toContain("6353 749953");
    }
    for (const source of [legalDocument, privacy, dataMap]) {
      expect(source).toContain("netcup GmbH");
      expect(source).toContain("Nürnberg");
    }
  });

  it("links every active entry surface to all legal documents", () => {
    for (const source of [
      settings,
      launchGate,
      connectSource,
      connect,
      legalDocument,
    ]) {
      for (const route of legalRoutes) expect(source).toContain(route);
    }
  });

  it("does not retain the obsolete account and community policy", () => {
    expect(legalDocument).not.toContain("We process account data");
    expect(legalDocument).not.toContain("public community at flash-n-flip.com");
    expect(legalDocument).not.toContain("Konto löschen");
  });

  it("keeps every unresolved release decision explicit", () => {
    for (const marker of [
      "TODO_RETENTION",
      "TODO_LEGACY_DELETION",
      "TODO_AV_CONTRACT",
      "TODO_BUSINESS_STATUS",
      "TODO_TAX_STATUS",
      "TODO_DSA_TRADER_STATUS",
      "TODO_MINOR_POLICY",
      "TODO_LEGAL_REVIEW",
    ]) {
      expect(openItems).toContain(marker);
    }
  });
});
