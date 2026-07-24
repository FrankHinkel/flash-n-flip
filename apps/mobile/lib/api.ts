import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { FlashCardsApi, type AuthTokens } from "@flashcards/api-client";

const tokenKey = "flora-auth-v1";

export const tokenStore = {
  async get(): Promise<AuthTokens | null> {
    const value = await SecureStore.getItemAsync(tokenKey);
    return value ? (JSON.parse(value) as AuthTokens) : null;
  },
  async set(tokens: AuthTokens | null): Promise<void> {
    if (tokens)
      await SecureStore.setItemAsync(tokenKey, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(tokenKey);
  },
};

export const api = new FlashCardsApi(
  process.env.EXPO_PUBLIC_API_URL ??
    String(Constants.expoConfig?.extra?.apiUrl ?? "http://127.0.0.1:4000"),
  tokenStore,
);
