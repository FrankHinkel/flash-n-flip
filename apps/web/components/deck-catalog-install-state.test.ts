import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
      'disabled={allInstalled || isInstalling("world-all")}',
    );
    expect(catalog).toContain("disabled={isInstalling(template.id)}");
    expect(catalog).toContain("disabled={isInstalling(subregion.id)}");
  });

  it("uses one reference label while keeping each help link accessible", () => {
    expect(catalog).toContain(
      '{text("Developer Reference", "Entwickler-Referenz")}',
    );
    expect(
      catalog.match(/text\("Open reference", "Referenz öffnen"\)/g),
    ).toHaveLength(2);
    expect(catalog).not.toContain('text("Open library", "Bibliothek öffnen")');
    expect(catalog).not.toContain(
      "text(`Open ${deck.title}`, `${deck.title} öffnen`)",
    );
    expect(catalog).toContain("`Open ${deck.title} reference`");
  });
});
