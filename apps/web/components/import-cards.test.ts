import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { defaultImportFormat, importFormatOrder } from "./import-cards";

const source = readFileSync(new URL("./import-cards.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");

describe("import format priority", () => {
  it("opens the Flash-n-Flip importer first and keeps Anki second", () => {
    expect(importFormatOrder).toEqual(["FNF", "APKG", "CSV"]);
    expect(defaultImportFormat).toBe("FNF");
  });

  it("keeps advanced Anki configuration closed behind one Options disclosure", () => {
    expect(source).toMatch(
      /<details[\s\S]*?className="anki-import-options"[\s\S]*?<summary>[\s\S]*?text\("Options", "Optionen"\)/,
    );
    expect(source).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(styles).toMatch(
      /\.anki-import-options > summary\s*\{[^}]*min-height:\s*64px;/s,
    );
  });

  it("parses and commits an Anki file with one Import action", () => {
    expect(source).not.toContain("commitPlan");
    expect(source).not.toContain("Prepare final summary");
    expect(source).not.toContain("Endübersicht vorbereiten");
    expect(source).toMatch(
      /const parsed =[\s\S]*?await parseLocalAnkiPackage[\s\S]*?const result = await importLocalFilePackage/,
    );
    expect(source).toContain('text("Import locally", "Lokal importieren")');
  });
});
