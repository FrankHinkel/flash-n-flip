import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../drizzle/0011_anki_card_directions.sql", import.meta.url),
  "utf8",
);

describe("persisted Anki card direction migration", () => {
  it("repairs only missing unambiguous directions without touching progress", () => {
    expect(migration).toContain("ANKI_SAFE_MAPPING_V1");
    expect(migration).toContain("IN ('PRIMARY_A', 'PRIMARY_B')");
    expect(migration).toContain('"card"."question_locale" IS NULL');
    expect(migration).toContain('"card"."answer_locale" IS NULL');
    expect(migration).toContain('"version" = "card"."version" + 1');
    expect(migration).not.toMatch(/card_progress|review_events|delete\s+from/i);
  });
});
