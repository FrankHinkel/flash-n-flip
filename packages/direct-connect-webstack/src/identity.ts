import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeIdentity = {
  id: string;
  publicKey: string;
  storage: "KEYCHAIN";
};

type NativeIdentityPlugin = {
  getOrCreateIdentity(): Promise<NativeIdentity>;
  sign(input: { challenge: string }): Promise<{ signature: string }>;
  listTrustedPeers(): Promise<{ peers: TrustedPeer[] }>;
  saveTrustedPeer(input: { peer: TrustedPeer }): Promise<void>;
  deleteTrustedPeer(input: { deviceId: string }): Promise<void>;
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

export type TrustedPeer = {
  deviceId: string;
  publicKey: string;
  reconnectSecret: string;
  apiOrigin: string;
  createdAt: string;
  updatedAt: string;
};

type StoredBrowserIdentity = DeviceIdentity & {
  privateKey?: CryptoKey;
  verificationKey?: CryptoKey;
};

const identityDatabaseName = "flash-n-flip-device-identity";
const authorityDatabaseName = "flash-n-flip-local-authority-v2";

const openIdentityDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(identityDatabaseName, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("identity"))
        request.result.createObjectStore("identity");
      if (!request.result.objectStoreNames.contains("trustedPeers"))
        request.result.createObjectStore("trustedPeers", {
          keyPath: "deviceId",
        });
    };
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
    const stored = await requestResult<StoredBrowserIdentity | undefined>(
      store.get("current"),
    );
    if (
      stored &&
      typeof stored === "object" &&
      "id" in stored &&
      "publicKey" in stored &&
      stored.privateKey instanceof CryptoKey
    ) {
      const {
        privateKey: _privateKey,
        verificationKey: _verificationKey,
        ...identity
      } = stored;
      return identity;
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
        .put(
          {
            ...identity,
            privateKey: keys.privateKey,
            verificationKey: keys.publicKey,
          } satisfies StoredBrowserIdentity,
          "current",
        ),
    );
  } finally {
    writable.close();
  }
  return identity;
}

export const signDeviceChallenge = async (
  challenge: string,
): Promise<string> => {
  if (Capacitor.isNativePlatform())
    return (await nativeIdentity.sign({ challenge })).signature;
  const database = await openIdentityDatabase();
  try {
    const stored = await requestResult<StoredBrowserIdentity | undefined>(
      database
        .transaction("identity", "readonly")
        .objectStore("identity")
        .get("current"),
    );
    if (!stored?.privateKey)
      throw new Error("Die lokale Browser-Geräteidentität ist unvollständig.");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      stored.privateKey,
      new TextEncoder().encode(challenge),
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  } finally {
    database.close();
  }
};

const trustedPeer = (candidate: TrustedPeer): TrustedPeer => {
  if (
    !/^[0-9a-f-]{36}$/i.test(candidate.deviceId) ||
    !candidate.publicKey ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(candidate.reconnectSecret) ||
    !candidate.apiOrigin
  ) {
    throw new Error("Ungültiger vertrauenswürdiger Geräteeintrag.");
  }
  const origin = new URL(candidate.apiOrigin);
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
    )
  ) {
    throw new Error("Reconnect-Rendezvous muss HTTPS verwenden.");
  }
  return { ...candidate, apiOrigin: candidate.apiOrigin.replace(/\/$/, "") };
};

export async function listTrustedPeers(): Promise<TrustedPeer[]> {
  if (Capacitor.isNativePlatform()) {
    const result = await nativeIdentity.listTrustedPeers();
    return result.peers.map(trustedPeer);
  }
  const database = await openIdentityDatabase();
  try {
    const peers = await requestResult<TrustedPeer[]>(
      database
        .transaction("trustedPeers", "readonly")
        .objectStore("trustedPeers")
        .getAll(),
    );
    return peers.map(trustedPeer);
  } finally {
    database.close();
  }
}

export async function saveTrustedPeer(peer: TrustedPeer): Promise<void> {
  const parsed = trustedPeer(peer);
  if (Capacitor.isNativePlatform()) {
    await nativeIdentity.saveTrustedPeer({ peer: parsed });
    return;
  }
  const database = await openIdentityDatabase();
  try {
    await requestResult(
      database
        .transaction("trustedPeers", "readwrite")
        .objectStore("trustedPeers")
        .put(parsed),
    );
  } finally {
    database.close();
  }
}

export async function deleteTrustedPeer(deviceId: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await nativeIdentity.deleteTrustedPeer({ deviceId });
    return;
  }
  const database = await openIdentityDatabase();
  try {
    await requestResult(
      database
        .transaction("trustedPeers", "readwrite")
        .objectStore("trustedPeers")
        .delete(deviceId),
    );
  } finally {
    database.close();
  }
}
