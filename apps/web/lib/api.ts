"use client";

import {
  FlashAndFlipApi,
  resolveBrowserApiUrl,
  type AuthTokens,
} from "@flashcards/api-client";

const key = "flash-n-flip.auth.v1";
const legacyKey = "flora.auth.v1";
export const sessionClearedEvent = "flash-n-flip:session-cleared";

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const apiUrl = resolveBrowserApiUrl(
  configuredApiUrl,
  typeof window === "undefined" ? undefined : window.location.hostname,
);

export const browserTokenStore = {
  get(): AuthTokens | null {
    if (typeof window === "undefined") return null;
    const value =
      window.localStorage.getItem(key) ??
      window.localStorage.getItem(legacyKey);
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
        window.localStorage.setItem(key, JSON.stringify(migrated));
        window.localStorage.removeItem(legacyKey);
        return migrated;
      }
    } catch {
      // Invalid browser data is handled like an expired session.
    }
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(legacyKey);
    window.dispatchEvent(new Event(sessionClearedEvent));
    return null;
  },
  set(tokens: AuthTokens | null): void {
    if (typeof window === "undefined") return;
    if (tokens) window.localStorage.setItem(key, JSON.stringify(tokens));
    else {
      const hadSession =
        window.localStorage.getItem(key) !== null ||
        window.localStorage.getItem(legacyKey) !== null;
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(legacyKey);
      if (hadSession) window.dispatchEvent(new Event(sessionClearedEvent));
    }
  },
};

export const api = new FlashAndFlipApi(apiUrl, browserTokenStore);
