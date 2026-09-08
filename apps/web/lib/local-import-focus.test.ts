import { describe, expect, it } from "vitest";

import {
  importedDeckExpansionIds,
  localImportFocusDeckId,
} from "./local-import-focus";

describe("local import focus", () => {
  it("opens the imported Xefjord language deck instead of its empty collection root", () => {
    expect(
      localImportFocusDeckId({
        deckId: "language-hub",
        dictionaryDeckIds: ["xefjord-french"],
      }),
    ).toBe("xefjord-french");
  });

  it("expands every local parent needed to reveal the imported deck", () => {
    expect([
      ...(importedDeckExpansionIds(
        [
          { id: "root", parentDeckId: null },
          { id: "language-hub", parentDeckId: "root" },
          { id: "xefjord-french", parentDeckId: "language-hub" },
        ],
        "xefjord-french",
      ) ?? []),
    ]).toEqual(["language-hub", "root"]);
  });
});
