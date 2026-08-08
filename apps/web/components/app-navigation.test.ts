import { describe, expect, it } from "vitest";

import {
  appNavigationItemIsActive,
  appNavigationUsesCompactRail,
} from "./app-navigation";

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

  it("uses the compact rail for study and deck editing only", () => {
    expect(appNavigationUsesCompactRail("/app/learn")).toBe(true);
    expect(appNavigationUsesCompactRail("/app/decks/new")).toBe(true);
    expect(appNavigationUsesCompactRail("/app/decks/deck-1")).toBe(true);
    expect(appNavigationUsesCompactRail("/app/decks")).toBe(false);
    expect(appNavigationUsesCompactRail("/app/decks/import")).toBe(false);
  });
});
