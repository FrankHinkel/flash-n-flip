import { describe, expect, it } from "vitest";

import {
  canSafelyReloadForPwaUpdate,
  isFlashNFlipServiceWorkerRegistration,
  isNativeCapacitorRuntime,
  shouldReloadAfterPwaActivation,
} from "./pwa-update";

describe("PWA update platform boundary", () => {
  it("detects native Capacitor runtimes", () => {
    expect(
      isNativeCapacitorRuntime({
        Capacitor: { isNativePlatform: () => true, getPlatform: () => "ios" },
      }),
    ).toBe(true);
    expect(
      isNativeCapacitorRuntime({
        Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
      }),
    ).toBe(false);
  });

  it("blocks Web-only updates when a malformed bridge throws", () => {
    expect(
      isNativeCapacitorRuntime({
        Capacitor: {
          isNativePlatform: () => {
            throw new Error("bridge unavailable");
          },
        },
      }),
    ).toBe(true);
  });

  it("only allows reloads on non-editing application routes", () => {
    expect(canSafelyReloadForPwaUpdate("/app/settings")).toBe(true);
    expect(canSafelyReloadForPwaUpdate("/community/deck-1")).toBe(false);
    expect(canSafelyReloadForPwaUpdate("/app/learn")).toBe(false);
    expect(canSafelyReloadForPwaUpdate("/app/decks/import")).toBe(false);
    expect(canSafelyReloadForPwaUpdate("/app/decks/deck-1")).toBe(false);
    expect(canSafelyReloadForPwaUpdate("/login")).toBe(false);
  });

  it("only reloads the tab that explicitly requested activation", () => {
    expect(shouldReloadAfterPwaActivation(true, "/app/settings")).toBe(true);
    expect(shouldReloadAfterPwaActivation(false, "/app/settings")).toBe(false);
    expect(shouldReloadAfterPwaActivation(true, "/app/learn")).toBe(false);
  });

  it("only recognizes the root registration on the current origin", () => {
    expect(
      isFlashNFlipServiceWorkerRegistration(
        "https://flash-n-flip.com/",
        "https://flash-n-flip.com",
      ),
    ).toBe(true);
    expect(
      isFlashNFlipServiceWorkerRegistration(
        "https://flash-n-flip.com/another-app/",
        "https://flash-n-flip.com",
      ),
    ).toBe(false);
    expect(
      isFlashNFlipServiceWorkerRegistration(
        "https://example.com/",
        "https://flash-n-flip.com",
      ),
    ).toBe(false);
  });
});
