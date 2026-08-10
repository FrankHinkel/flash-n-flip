import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./deck-list.tsx", import.meta.url),
  "utf8",
);

describe("deck list storage failures", () => {
  it("keeps the current library and exposes a local storage error", () => {
    const reload = source.slice(
      source.indexOf("async function reload()"),
      source.indexOf("async function exportDeck"),
    );
    expect(reload).toContain("try {");
    expect(reload).toContain("setLibraryError(");
    expect(reload).not.toContain("setDecks([])");
  });
});
