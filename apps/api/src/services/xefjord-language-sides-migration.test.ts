import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../drizzle/0013_xefjord_language_sides.sql",
  ),
  "utf8",
);

describe("Xefjord existing-card language-side migration", () => {
  it("rebuilds both directions from preserved semantic fields", () => {
    expect(migration).toContain("'phrase translation'");
    expect(migration).toContain("'sentence translation'");
    expect(migration).toContain("coalesce(\"audio_content\"->'blocks'");
    expect(migration).toContain('\"question_locale\" = \"target_locale\"');
    expect(migration).toContain('\"answer_locale\" = \"target_locale\"');
  });

  it("keeps card identities and progress while updating materialized content", () => {
    expect(migration).toContain('UPDATE \"cards\" \"card\"');
    expect(migration).not.toContain('DELETE FROM \"cards\"');
    expect(migration).not.toContain('INSERT INTO \"cards\"');
    expect(migration).not.toContain('UPDATE \"card_progress\"');
  });
});
