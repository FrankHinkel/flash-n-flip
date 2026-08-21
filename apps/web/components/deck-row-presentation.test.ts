import { describe, expect, it } from "vitest";

import { displayedDeckDescription } from "./deck-row-presentation";

describe("deck row presentation", () => {
  it("omits empty and generated local APKG import descriptions", () => {
    expect(displayedDeckDescription("")).toBeNull();
    expect(displayedDeckDescription("   ")).toBeNull();
    expect(
      displayedDeckDescription("APKG-Import · lokal verarbeitet"),
    ).toBeNull();
    expect(
      displayedDeckDescription("APKG-Import lokal verarbeitet."),
    ).toBeNull();
  });

  it("keeps meaningful descriptions", () => {
    expect(displayedDeckDescription("  Eigene Wortliste  ")).toBe(
      "Eigene Wortliste",
    );
  });
});
