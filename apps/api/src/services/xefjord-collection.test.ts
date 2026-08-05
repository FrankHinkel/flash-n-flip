import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  isXefjordLanguageDeckTitle,
  xefjordCollectionTitle,
} from "./xefjord-collection.js";

const importRoutes = readFileSync(
  new URL("../routes/import-export-routes.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../drizzle/0012_xefjord_complete_collection.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Xefjord collection grouping", () => {
  it("recognizes language decks but not the shared collection", () => {
    expect(isXefjordLanguageDeckTitle("Xefjord's Complete Arabic (MSA)")).toBe(
      true,
    );
    expect(isXefjordLanguageDeckTitle("Xefjord’s Complete Spanish")).toBe(true);
    expect(isXefjordLanguageDeckTitle(xefjordCollectionTitle)).toBe(false);
    expect(isXefjordLanguageDeckTitle("My Xefjord deck")).toBe(false);
  });

  it("groups direct imports and migrates existing root decks", () => {
    expect(importRoutes).toContain("groupXefjordCollection: true");
    expect(importRoutes).toContain("pg_advisory_xact_lock");
    expect(importRoutes).toContain("ungroupedLanguageDecks.length >= 2");
    expect(migration).toContain("HAVING count(*) >= 2");
    expect(migration).toContain(
      "\"source_template_key\" = 'xefjord-complete-collection'",
    );
  });
});
