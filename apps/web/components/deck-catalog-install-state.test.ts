import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { uiMessageKey } from "./i18n-test-helpers";

const catalog = readFileSync(
  new URL("./deck-catalog.tsx", import.meta.url),
  "utf8",
);

describe("discover catalog install state", () => {
  it("does not globally disable every download button", () => {
    expect(catalog).not.toContain("disabled={Boolean(installing)}");
    expect(catalog).toContain('disabled={isInstalling("conjugations")}');
    expect(catalog).toContain('disabled={isInstalling("irregular-verbs")}');
    expect(catalog).toContain('disabled={isInstalling("core-languages")}');
    expect(catalog).toContain(
      'disabled={isInstalling("developer-reference-library")}',
    );
    expect(catalog).toContain('disabled={isInstalling("fnf-help-library")}');
    expect(catalog).toContain(
      'disabled={allCurrent || isInstalling("world-all")}',
    );
    expect(catalog).toContain("disabled={isInstalling(template.id)}");
    expect(catalog).toContain("disabled={isInstalling(subregion.id)}");
  });

  it("disables updates only when the signed installed digest is current", () => {
    expect(catalog).toContain('template.status === "CURRENT"');
    expect(catalog).toContain('fnfHelpTemplate.status === "CURRENT"');
    expect(catalog).toContain('text("catalog.release.upToDate")');
    expect(catalog).toContain('text("catalog.release.updateAvailable")');
    expect(catalog).toContain("release.contentSha256.slice(0, 8)");
    expect(catalog).toContain('text("catalog.release.signed", [published])');
  });

  it("opens each installed reference through one clearly labelled entry", () => {
    expect(catalog).toContain(
      `text("${uiMessageKey("Developer Reference", "Entwickler-Referenz")}")`,
    );
    const openReferenceKey = uiMessageKey("Open reference", "Referenz öffnen");
    expect(
      catalog.match(new RegExp(`text\\("${openReferenceKey}"\\)`, "g")),
    ).toHaveLength(2);
    expect(catalog).not.toContain('text("Open library", "Bibliothek öffnen")');
    expect(catalog).not.toContain(
      "text(`Open ${deck.title}`, `${deck.title} öffnen`)",
    );
    expect(catalog).not.toContain("fnfHelpTemplate.referenceDecks.map");
    expect(catalog).toContain(
      "href={referenceHrefForDeck(fnfHelpTemplate.installedDeckId)}",
    );
    expect(catalog).toContain('text("legacy.a5270722d924")');
    expect(catalog).not.toContain(
      'text("Update library", "Bibliothek aktualisieren")',
    );
    const updateReferenceKey = uiMessageKey(
      "Update reference",
      "Referenz aktualisieren",
    );
    expect(
      catalog.match(new RegExp(`text\\("${updateReferenceKey}"\\)`, "g")),
    ).toHaveLength(2);
  });
});
