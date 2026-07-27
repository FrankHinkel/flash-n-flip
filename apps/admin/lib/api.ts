"use client";

import {
  FlashAndFlipApi,
  resolveBrowserApiUrl,
  type AuthTokens,
} from "@flashcards/api-client";

const key = "flash-n-flip.admin.auth.v1";
const legacyKey = "flora.admin.auth.v1";
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const apiUrl = resolveBrowserApiUrl(
  configuredApiUrl,
  typeof window === "undefined" ? undefined : window.location.hostname,
);

export const api = new FlashAndFlipApi(apiUrl, {
  get: () => {
    if (typeof window === "undefined") return null;
    const value = sessionStorage.getItem(key);
    localStorage.removeItem(key);
    localStorage.removeItem(legacyKey);
    return value ? (JSON.parse(value) as AuthTokens) : null;
  },
  set: (tokens) => {
    if (tokens) sessionStorage.setItem(key, JSON.stringify(tokens));
    else {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
      localStorage.removeItem(legacyKey);
    }
  },
});
