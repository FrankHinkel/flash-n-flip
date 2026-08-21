import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studySessionSource = readFileSync(
  new URL("./study-session.tsx", import.meta.url),
  "utf8",
);

describe("study startup data access", () => {
  it("uses deck metadata without scanning all cards, reviews, and media", () => {
    expect(studySessionSource).toContain("listLocalProductDeckMetadata(");
    expect(studySessionSource).not.toContain("listLocalProductDecks(");
  });
});
