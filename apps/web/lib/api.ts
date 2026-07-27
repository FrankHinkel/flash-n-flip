"use client";

import { FlashAndFlipApi, type AuthTokens } from "@flashcards/api-client";

import {
  browserAuthStorageKey,
  legacyBrowserAuthStorageKey,
} from "./auth-storage";

export const sessionClearedEvent = "flash-n-flip:session-cleared";

export const browserTokenStore = {
  get(): AuthTokens | null {
    if (typeof window === "undefined") return null;
    const value =
      window.localStorage.getItem(browserAuthStorageKey) ??
      window.localStorage.getItem(legacyBrowserAuthStorageKey);
    if (!value) return null;
    try {
      const tokens = JSON.parse(value) as Partial<AuthTokens>;
      if (
        typeof tokens.accessToken === "string" &&
        typeof tokens.refreshToken === "string"
      ) {
        const migrated = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        };
        window.localStorage.setItem(
          browserAuthStorageKey,
          JSON.stringify(migrated),
        );
        window.localStorage.removeItem(legacyBrowserAuthStorageKey);
        return migrated;
      }
    } catch {
      // Invalid browser data is handled like an expired session.
    }
    window.localStorage.removeItem(browserAuthStorageKey);
    window.localStorage.removeItem(legacyBrowserAuthStorageKey);
    window.dispatchEvent(new Event(sessionClearedEvent));
    return null;
  },
  set(tokens: AuthTokens | null): void {
    if (typeof window === "undefined") return;
    if (tokens)
      window.localStorage.setItem(
        browserAuthStorageKey,
        JSON.stringify(tokens),
      );
    else {
      const hadSession =
        window.localStorage.getItem(browserAuthStorageKey) !== null ||
        window.localStorage.getItem(legacyBrowserAuthStorageKey) !== null;
      window.localStorage.removeItem(browserAuthStorageKey);
      window.localStorage.removeItem(legacyBrowserAuthStorageKey);
      if (hadSession) window.dispatchEvent(new Event(sessionClearedEvent));
    }
  },
};

export const api = new FlashAndFlipApi("/api", browserTokenStore);
