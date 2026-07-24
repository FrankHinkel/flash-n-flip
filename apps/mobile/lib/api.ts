import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

import { FlashAndFlipApi, type AuthTokens } from "@flashcards/api-client";

const tokenKey = "flash-n-flip-auth-v1";
const legacyTokenKey = "flora-auth-v1";

export const tokenStore = {
  async get(): Promise<AuthTokens | null> {
    const value =
      (await SecureStore.getItemAsync(tokenKey)) ??
      (await SecureStore.getItemAsync(legacyTokenKey));
    if (value && !(await SecureStore.getItemAsync(tokenKey))) {
      await SecureStore.setItemAsync(tokenKey, value);
      await SecureStore.deleteItemAsync(legacyTokenKey);
    }
    return value ? (JSON.parse(value) as AuthTokens) : null;
  },
  async set(tokens: AuthTokens | null): Promise<void> {
    if (tokens)
      await SecureStore.setItemAsync(tokenKey, JSON.stringify(tokens));
    else {
      await SecureStore.deleteItemAsync(tokenKey);
      await SecureStore.deleteItemAsync(legacyTokenKey);
    }
  },
};

export const api = new FlashAndFlipApi(
  process.env.EXPO_PUBLIC_API_URL ??
    String(Constants.expoConfig?.extra?.apiUrl ?? "http://127.0.0.1:4000"),
  tokenStore,
);
