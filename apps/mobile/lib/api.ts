import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { FlashAndFlipApi, type AuthTokens } from "@flashcards/api-client";

import { resolveMobileApiUrl } from "./api-url";

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

const bundledApiUrl = String(
  Constants.expoConfig?.extra?.apiUrl ?? "https://flash-n-flip.com/api",
);

const configuredApiUrl = resolveMobileApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  bundledApiUrl,
  Constants.expoConfig?.hostUri,
  __DEV__,
  {
    isDevice: Device.isDevice,
    platform:
      Platform.OS === "android" || Platform.OS === "ios" ? Platform.OS : "web",
  },
);

export const api = new FlashAndFlipApi(configuredApiUrl, tokenStore);
