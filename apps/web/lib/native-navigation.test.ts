import { describe, expect, it } from "vitest";

import {
  nativeHrefForTab,
  nativeNavigationContractVersion,
  nativeTabForPathname,
  nativeTabIds,
} from "./native-navigation";

describe("native navigation contract", () => {
  it("keeps stable versioned tab identities", () => {
    expect(nativeNavigationContractVersion).toBe(1);
    expect(nativeTabIds).toEqual([
      "overview",
      "decks",
      "study",
      "discover",
      "local",
    ]);
  });

  it.each([
    ["/app", "overview"],
    ["/app/decks", "decks"],
    ["/app/decks/example", "decks"],
    ["/app/learn", "study"],
    ["/app/memory", "study"],
    ["/community", "discover"],
    ["/community/numbers", "discover"],
    ["/app/settings", "local"],
  ] as const)("maps %s to %s", (pathname, tabId) => {
    expect(nativeTabForPathname(pathname)).toBe(tabId);
  });

  it("leaves unknown and modal routes on the last native selection", () => {
    expect(nativeTabForPathname("/app/help")).toBeNull();
    expect(nativeTabForPathname("/legal/privacy")).toBeNull();
  });

  it("keeps ownership of the remembered study route in the Web app", () => {
    expect(nativeHrefForTab("study", "/app/learn?deckId=remembered")).toBe(
      "/app/learn?deckId=remembered",
    );
    expect(nativeHrefForTab("overview", "/app/learn?deckId=ignored")).toBe(
      "/app",
    );
  });
});
