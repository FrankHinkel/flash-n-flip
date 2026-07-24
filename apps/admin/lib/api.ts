"use client";

import { FlashCardsApi, type AuthTokens } from "@flashcards/api-client";

const key = "flora.admin.auth.v1";
export const api = new FlashCardsApi(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  {
    get: () => {
      const value =
        typeof window === "undefined" ? null : localStorage.getItem(key);
      return value ? (JSON.parse(value) as AuthTokens) : null;
    },
    set: (tokens) => {
      if (tokens) localStorage.setItem(key, JSON.stringify(tokens));
      else localStorage.removeItem(key);
    },
  },
);
