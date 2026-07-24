"use client";

import { FlashAndFlipApi, type AuthTokens } from "@flashcards/api-client";

const key = "flash-n-flip.admin.auth.v1";
const legacyKey = "flora.admin.auth.v1";
export const api = new FlashAndFlipApi(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  {
    get: () => {
      if (typeof window === "undefined") return null;
      const value =
        localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
      if (value && !localStorage.getItem(key)) {
        localStorage.setItem(key, value);
        localStorage.removeItem(legacyKey);
      }
      return value ? (JSON.parse(value) as AuthTokens) : null;
    },
    set: (tokens) => {
      if (tokens) localStorage.setItem(key, JSON.stringify(tokens));
      else {
        localStorage.removeItem(key);
        localStorage.removeItem(legacyKey);
      }
    },
  },
);
