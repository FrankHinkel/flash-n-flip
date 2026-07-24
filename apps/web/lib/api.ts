"use client";

import { FlashCardsApi, type AuthTokens } from "@flashcards/api-client";

const key = "flora.auth.v1";

export const browserTokenStore = {
  get(): AuthTokens | null {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as AuthTokens) : null;
  },
  set(tokens: AuthTokens | null): void {
    if (typeof window === "undefined") return;
    if (tokens) window.localStorage.setItem(key, JSON.stringify(tokens));
    else window.localStorage.removeItem(key);
  },
};

export const api = new FlashCardsApi(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  browserTokenStore,
);
