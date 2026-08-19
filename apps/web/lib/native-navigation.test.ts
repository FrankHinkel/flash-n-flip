import { beforeEach, describe, expect, it, vi } from "vitest";

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => "web"),
  isPluginAvailable: vi.fn((_name?: string) => false),
  ready: vi.fn(async () => undefined),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
    isPluginAvailable: capacitorMocks.isPluginAvailable,
  },
  registerPlugin: vi.fn((name: string) =>
    name === "FlashNFlipLaunch" ? { ready: capacitorMocks.ready } : {},
  ),
}));

import {
  nativeHrefForTab,
  nativeNavigationContractVersion,
  nativeTabForPathname,
  nativeTabIds,
  signalNativeLaunchReady,
} from "./native-navigation";

describe("native navigation contract", () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.getPlatform.mockReturnValue("web");
    capacitorMocks.isPluginAvailable.mockReturnValue(false);
    capacitorMocks.ready.mockClear();
  });

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

  it("signals a mounted Web app through the dedicated iOS launch plugin", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue("ios");
    capacitorMocks.isPluginAvailable.mockImplementation(
      (name?: string) => name === "FlashNFlipLaunch",
    );

    signalNativeLaunchReady();
    await vi.waitFor(() => expect(capacitorMocks.ready).toHaveBeenCalledOnce());
  });

  it("does not signal launch readiness outside the native iOS shell", () => {
    signalNativeLaunchReady();
    expect(capacitorMocks.ready).not.toHaveBeenCalled();
  });
});
