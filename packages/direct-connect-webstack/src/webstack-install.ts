import type { SignedWebstackRelease } from "@flashcards/domain/signed-webstack";
import {
  verifyWebstackRelease,
  type TrustedWebstackSigningKeys,
} from "@flashcards/sync/webstack-release";

const databaseName = "flash-n-flip-peer-webstack-v1";
const storeName = "activation";
const activationKey = "current";
const cachePrefix = "flash-n-flip-peer-webstack-";

export type WebstackActivation = {
  buildId: string;
  appVersion: string;
  entrypoint: string;
  previousBuildId: string | null;
  previousAppVersion: string | null;
  previousEntrypoint: string | null;
  activatedAt: string;
  healthy: boolean;
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const readActivation = async (): Promise<WebstackActivation | null> => {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(storeName, "readonly")
        .objectStore(storeName)
        .get(activationKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve((request.result as WebstackActivation | undefined) ?? null);
    });
  } finally {
    database.close();
  }
};

const writeActivation = async (value: WebstackActivation): Promise<void> => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(value, activationKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
};

const cacheName = (buildId: string): string => `${cachePrefix}${buildId}`;

export async function currentWebstackActivation(): Promise<WebstackActivation | null> {
  return readActivation();
}

export async function installVerifiedWebstack(input: {
  release: SignedWebstackRelease;
  assets: ReadonlyMap<string, Uint8Array>;
  trustedKeys: TrustedWebstackSigningKeys;
  bootstrapVersion: string;
}): Promise<WebstackActivation> {
  const current = await readActivation();
  const verified = await verifyWebstackRelease({
    release: input.release,
    assets: input.assets,
    trustedKeys: input.trustedKeys,
    bootstrapVersion: input.bootstrapVersion,
    currentAppVersion: current?.appVersion,
  });
  const stagedCacheName = cacheName(verified.manifest.buildId);
  await caches.delete(stagedCacheName);
  const staged = await caches.open(stagedCacheName);
  try {
    for (const asset of verified.manifest.assets) {
      const bytes = input.assets.get(asset.path)!;
      await staged.put(
        new Request(`/${asset.path}`),
        new Response(bytes.slice().buffer, {
          headers: {
            "content-type": asset.mediaType,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        }),
      );
    }
  } catch (cause) {
    await caches.delete(stagedCacheName);
    throw cause;
  }
  const activation: WebstackActivation = {
    buildId: verified.manifest.buildId,
    appVersion: verified.manifest.appVersion,
    entrypoint: verified.manifest.entrypoint,
    previousBuildId: current?.buildId ?? null,
    previousAppVersion: current?.appVersion ?? null,
    previousEntrypoint: current?.entrypoint ?? null,
    activatedAt: new Date().toISOString(),
    healthy: false,
  };
  await writeActivation(activation);
  const retained = new Set(
    [activation.buildId, activation.previousBuildId]
      .filter((value): value is string => Boolean(value))
      .map(cacheName),
  );
  for (const name of await caches.keys()) {
    if (name.startsWith(cachePrefix) && !retained.has(name))
      await caches.delete(name);
  }
  return activation;
}

export async function markCurrentWebstackHealthy(): Promise<void> {
  const current = await readActivation();
  if (!current || current.healthy) return;
  await writeActivation({ ...current, healthy: true });
}

export async function rollbackWebstack(): Promise<boolean> {
  const current = await readActivation();
  if (
    !current?.previousBuildId ||
    !current.previousAppVersion ||
    !current.previousEntrypoint
  )
    return false;
  await writeActivation({
    buildId: current.previousBuildId,
    appVersion: current.previousAppVersion,
    entrypoint: current.previousEntrypoint,
    previousBuildId: current.buildId,
    previousAppVersion: current.appVersion,
    previousEntrypoint: current.entrypoint,
    activatedAt: new Date().toISOString(),
    healthy: true,
  });
  return true;
}
