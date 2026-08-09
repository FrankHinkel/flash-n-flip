"use client";

import {
  browserAuthStorageKey,
  legacyBrowserAuthStorageKey,
} from "./auth-storage";
import { retireLegacyNativeLocalData } from "@flashcards/direct-connect-webstack/local-authority-storage";

export const localProductGeneration = 2;
const cleanupMarker = `flash-n-flip.local-generation.${localProductGeneration}`;
const legacyIndexedDatabases = [
  "flash-n-flip-local-authority",
  "flora-offline-v1",
] as const;

const deleteIndexedDatabase = (name: string): Promise<void> =>
  new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });

export async function retireLegacyLocalProductData(): Promise<void> {
  if (localStorage.getItem(cleanupMarker) === "complete") return;
  await Promise.all([
    ...legacyIndexedDatabases.map(deleteIndexedDatabase),
    retireLegacyNativeLocalData(),
  ]);
  localStorage.removeItem(browserAuthStorageKey);
  localStorage.removeItem(legacyBrowserAuthStorageKey);
  localStorage.setItem(cleanupMarker, "complete");
}
