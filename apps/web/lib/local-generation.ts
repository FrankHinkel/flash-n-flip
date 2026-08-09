"use client";

import {
  browserAuthStorageKey,
  legacyBrowserAuthStorageKey,
} from "./auth-storage";
import { retireLegacyNativeLocalData } from "@flashcards/direct-connect-webstack/local-authority-storage";
import {
  appleCloudAccountStatus,
  downloadAppleCloudBackup,
  isAppleCloudRuntime,
} from "@flashcards/direct-connect-webstack/apple-cloud-backup";

import {
  localProductRepository,
  restoreLocalProductBackupEnvelope,
} from "./local-product-repository";

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

export async function bootstrapAppleCloudBackupIfFresh(): Promise<boolean> {
  if (!isAppleCloudRuntime()) return false;
  const repository = await localProductRepository();
  const [mutations, media] = await Promise.all([
    repository.authority.listMutationJournal(),
    repository.listMedia(),
  ]);
  if (mutations.length > 0 || media.length > 0) return false;
  if ((await appleCloudAccountStatus()) !== "AVAILABLE") return false;
  const backup = await downloadAppleCloudBackup();
  if (!backup) return false;
  await restoreLocalProductBackupEnvelope(backup);
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return true;
}
