"use client";

import { FlashCardsApi, type AuthTokens } from "@flashcards/api-client";

const key = "flora.auth.v1";
export const sessionClearedEvent = "flora:session-cleared";

export const browserTokenStore = {
  get(): AuthTokens | null {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(key);
    if (!value) return null;
    try {
      const tokens = JSON.parse(value) as Partial<AuthTokens>;
      if (
        typeof tokens.accessToken === "string" &&
        typeof tokens.refreshToken === "string"
      ) {
        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        };
      }
    } catch {
      // Invalid browser data is handled like an expired session.
    }
    window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(sessionClearedEvent));
    return null;
  },
  set(tokens: AuthTokens | null): void {
    if (typeof window === "undefined") return;
    if (tokens) window.localStorage.setItem(key, JSON.stringify(tokens));
    else {
      const hadSession = window.localStorage.getItem(key) !== null;
      window.localStorage.removeItem(key);
      if (hadSession) window.dispatchEvent(new Event(sessionClearedEvent));
    }
  },
};

export const api = new FlashCardsApi(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  browserTokenStore,
);
