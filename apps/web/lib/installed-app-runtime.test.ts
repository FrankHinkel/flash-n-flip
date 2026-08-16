import { describe, expect, it } from "vitest";

import {
  installedAppDisplayModeQueries,
  isInstalledAppRuntime,
  requiresInstalledAppRuntime,
} from "./installed-app-runtime";

describe("installed application runtime", () => {
  it("allows native Capacitor applications", () => {
    expect(
      isInstalledAppRuntime({
        Capacitor: { isNativePlatform: () => true },
      }),
    ).toBe(true);
  });

  it.each(installedAppDisplayModeQueries)("allows %s", (activeQuery) => {
    expect(
      isInstalledAppRuntime({
        matchMedia: (query: string) => ({ matches: query === activeQuery }),
        navigator: {},
      }),
    ).toBe(true);
  });

  it("supports the legacy iOS standalone signal", () => {
    expect(
      isInstalledAppRuntime({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      }),
    ).toBe(true);
  });

  it.each(["localhost", "127.0.0.1", "::1"])(
    "allows an ordinary browser on the loopback host %s",
    (hostname) => {
      expect(
        isInstalledAppRuntime({
          location: { hostname },
          matchMedia: () => ({ matches: false }),
          navigator: {},
        }),
      ).toBe(true);
    },
  );

  it("blocks an ordinary browser and browser fullscreen", () => {
    expect(
      isInstalledAppRuntime({
        matchMedia: (query: string) => ({
          matches: query === "(display-mode: fullscreen)",
        }),
        navigator: {},
      }),
    ).toBe(false);
  });

  it("fails closed when display-mode detection is unavailable", () => {
    expect(isInstalledAppRuntime({ navigator: {} })).toBe(false);
    expect(
      isInstalledAppRuntime({
        matchMedia: () => {
          throw new Error("unavailable");
        },
        navigator: {},
      }),
    ).toBe(false);
  });

  it.each([
    "/app",
    "/app/decks",
    "/community",
    "/community/deck",
    "/login",
    "/register",
    "/password-change",
    "/password-reset",
  ])("protects the product route %s", (pathname) => {
    expect(requiresInstalledAppRuntime(pathname)).toBe(true);
  });

  it.each(["/", "/pwa", "/connect", "/legal/privacy", "/unknown"])(
    "keeps the public route %s outside the installed-app boundary",
    (pathname) => {
      expect(requiresInstalledAppRuntime(pathname)).toBe(false);
    },
  );
});
