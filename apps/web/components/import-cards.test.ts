import { describe, expect, it } from "vitest";

import { defaultImportFormat, importFormatOrder } from "./import-cards";

describe("import format priority", () => {
  it("opens the Flash-n-Flip importer first and keeps Anki second", () => {
    expect(importFormatOrder).toEqual(["FNF", "APKG", "CSV"]);
    expect(defaultImportFormat).toBe("FNF");
  });
});
