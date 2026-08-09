import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeIdentity = {
  id: string;
  publicKey: string;
  storage: "KEYCHAIN";
};

type NativeIdentityPlugin = {
  getOrCreateIdentity(): Promise<NativeIdentity>;
  sign(input: { challenge: string }): Promise<{ signature: string }>;
};

const nativeIdentity =
  registerPlugin<NativeIdentityPlugin>("FlashNFlipIdentity");

export type DeviceIdentity =
  | NativeIdentity
  | {
      id: string;
      publicKey: string;
      storage: "INDEXED_DB";
    };

const identityDatabaseName = "flash-n-flip-device-identity";
const authorityDatabaseName = "flash-n-flip-local-authority-v2";

const openIdentityDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(identityDatabaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("identity");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const existingAuthorityDeviceId = async (): Promise<string | null> => {
  const databases = await indexedDB.databases?.();
  if (
    databases &&
    !databases.some((database) => database.name === authorityDatabaseName)
  ) {
    return null;
  }
  return new Promise((resolve) => {
    const request = indexedDB.open(authorityDatabaseName);
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      resolve(null);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("metadata")) {
        database.close();
        resolve(null);
        return;
      }
      const transaction = database.transaction("metadata", "readonly");
      const read = transaction.objectStore("metadata").get("authority");
      read.onerror = () => {
        database.close();
        resolve(null);
      };
      read.onsuccess = () => {
        database.close();
        const id = (read.result as { deviceId?: unknown } | undefined)
          ?.deviceId;
        resolve(typeof id === "string" ? id : null);
      };
    };
  });
};

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  if (Capacitor.isNativePlatform()) {
    return nativeIdentity.getOrCreateIdentity();
  }
  const database = await openIdentityDatabase();
  try {
    const transaction = database.transaction("identity", "readonly");
    const store = transaction.objectStore("identity");
    const stored = await requestResult(store.get("current"));
    if (
      stored &&
      typeof stored === "object" &&
      "id" in stored &&
      "publicKey" in stored
    ) {
      return stored as DeviceIdentity;
    }
  } finally {
    database.close();
  }
  const keys = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("spki", keys.publicKey);
  const identity: DeviceIdentity = {
    id: (await existingAuthorityDeviceId()) ?? crypto.randomUUID(),
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
    storage: "INDEXED_DB",
  };
  const writable = await openIdentityDatabase();
  try {
    await requestResult(
      writable
        .transaction("identity", "readwrite")
        .objectStore("identity")
        .put(identity, "current"),
    );
  } finally {
    writable.close();
  }
  return identity;
}

export const signDeviceChallenge = async (
  challenge: string,
): Promise<string> => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Browser identity signing is not used in phase 1");
  }
  return (await nativeIdentity.sign({ challenge })).signature;
};
