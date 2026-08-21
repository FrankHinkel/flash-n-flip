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
    expect(nativeTabIds).toEqual(["overview", "decks", "discover", "local"]);
  });

  it.each([
    ["/app", "overview"],
    ["/app/decks", "decks"],
    ["/app/decks/example", "decks"],
    ["/community", "discover"],
    ["/community/numbers", "discover"],
    ["/app/settings", "local"],
  ] as const)("maps %s to %s", (pathname, tabId) => {
    expect(nativeTabForPathname(pathname)).toBe(tabId);
  });

  it("leaves unknown and modal routes on the last native selection", () => {
    expect(nativeTabForPathname("/app/learn")).toBeNull();
    expect(nativeTabForPathname("/app/memory")).toBeNull();
    expect(nativeTabForPathname("/app/help")).toBeNull();
    expect(nativeTabForPathname("/legal/privacy")).toBeNull();
  });

  it("routes the four native top-level destinations", () => {
    expect(nativeHrefForTab("overview")).toBe("/app");
    expect(nativeHrefForTab("decks")).toBe("/app/decks");
    expect(nativeHrefForTab("discover")).toBe("/community");
    expect(nativeHrefForTab("local")).toBe("/app/settings");
  });

  it("keeps an old native Study tab functional during app updates", () => {
    expect(nativeHrefForTab("study", "/app/learn?deckId=remembered")).toBe(
      "/app/learn?deckId=remembered",
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
