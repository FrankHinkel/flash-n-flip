import { describe, expect, it } from "vitest";

import { defaultContinueRatings } from "./study-continue";
import { resolveMemoryRouteSelection } from "./study-memory-route";

describe("Memory route selection", () => {
  it("keeps the deck, supported ratings and pair count", () => {
    expect(
      resolveMemoryRouteSelection(
        new URLSearchParams(
          "deckId=biology&ratings=AGAIN%2CGOOD%2CINVALID&pairs=10",
        ),
      ),
    ).toEqual({
      deckId: "biology",
      ratings: ["AGAIN", "GOOD"],
      pairCount: 10,
    });
  });

  it("uses the established defaults for missing or invalid parameters", () => {
    expect(
      resolveMemoryRouteSelection(new URLSearchParams("pairs=99")),
    ).toEqual({
      deckId: "",
      ratings: [...defaultContinueRatings],
      pairCount: 6,
    });
  });
});
