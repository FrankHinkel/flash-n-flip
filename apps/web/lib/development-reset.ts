"use client";

import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite } from "@flashcards/direct-connect-webstack/native-database";

const databases = [
  "flash-n-flip-local-authority-v2",
  "flash-n-flip-cloud-staging-v1",
  "flash-n-flip-cloud-library-binding-v1",
  "flash-n-flip-device-identity",
  "flash-n-flip-phase-one",
  "flash-n-flip-peer-webstack-v1",
];

const deleteBrowserDatabase = (name: string): Promise<void> => new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase(name);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error(`Could not delete ${name}`));
  request.onblocked = () => reject(new Error(`Close other Flash-n-Flip tabs before deleting ${name}`));
});

export async function eraseAllLocalFlashNFlipData(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    for (const database of ["flash-n-flip-local-v2", "flash-n-flip-cloud-staging-v1"]) {
      await CapacitorSQLite.closeConnection({database, readonly: false}).catch(() => undefined);
      await CapacitorSQLite.deleteDatabase({database, readonly: false});
    }
  } else {
    await Promise.all(databases.map(deleteBrowserDatabase));
  }
  for (const storage of [localStorage, sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith("flash-n-flip") || key?.startsWith("fnf.")) storage.removeItem(key);
    }
  }
  if ("caches" in window) await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
}
