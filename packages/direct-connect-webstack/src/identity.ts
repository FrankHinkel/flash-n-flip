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

export async function getOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  if (Capacitor.isNativePlatform()) {
    return nativeIdentity.getOrCreateIdentity();
  }
  const database = await openIdentityDatabase();
  try {
    const transaction = database.transaction("identity", "readwrite");
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
    const keys = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const publicKey = await crypto.subtle.exportKey("spki", keys.publicKey);
    const identity: DeviceIdentity = {
      id: crypto.randomUUID(),
      publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
      storage: "INDEXED_DB",
    };
    store.put(identity, "current");
    return identity;
  } finally {
    database.close();
  }
}

export const signDeviceChallenge = async (
  challenge: string,
): Promise<string> => {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Browser identity signing is not used in phase 1");
  }
  return (await nativeIdentity.sign({ challenge })).signature;
};
