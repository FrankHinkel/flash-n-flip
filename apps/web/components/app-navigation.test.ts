import { describe, expect, it } from "vitest";

import { appNavigationItemIsActive } from "./app-navigation";

describe("application navigation state", () => {
  it("matches nested routes without selecting overview everywhere", () => {
    expect(appNavigationItemIsActive("/app", "/app")).toBe(true);
    expect(appNavigationItemIsActive("/app/decks/123", "/app/decks")).toBe(
      true,
    );
    expect(appNavigationItemIsActive("/app/decks", "/app")).toBe(false);
  });

  it("ignores remembered study query parameters", () => {
    expect(
      appNavigationItemIsActive(
        "/app/learn",
        "/app/learn?deckId=deck-1&practice=all",
      ),
    ).toBe(true);
  });
});
