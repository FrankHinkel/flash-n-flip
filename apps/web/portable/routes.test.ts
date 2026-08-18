import { describe, expect, it } from "vitest";

import { resolvePortableRoute } from "./routes";

describe("portable product route coverage", () => {
  it.each([
    ["/app", "dashboard"],
    ["/app/decks", "decks"],
    ["/app/decks/new", "deck-new"],
    ["/app/decks/import", "deck-import"],
    ["/app/learn", "learn"],
    ["/app/memory", "memory"],
    ["/app/settings", "settings"],
    ["/app/help", "help"],
    ["/community", "community"],
    ["/community/example-deck", "community"],
    ["/community/numbers", "numbers"],
  ])("routes %s to %s", (pathname, kind) => {
    expect(resolvePortableRoute(pathname).kind).toBe(kind);
  });

  it("keeps an encoded deck identifier for the editor", () => {
    expect(resolvePortableRoute("/app/decks/biology%2Fcells")).toEqual({
      kind: "deck-edit",
      deckId: "biology/cells",
    });
  });

  it("uses the local not-found screen only for unknown destinations", () => {
    expect(resolvePortableRoute("/app/unknown")).toEqual({
      kind: "not-found",
    });
  });
});
