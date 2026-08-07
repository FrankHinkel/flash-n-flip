"use client";

import {
  createId,
  pairingQrPayloadSchema,
  type DeviceCapability,
  type DevicePlatform,
  type PairingQrPayload,
} from "@flashcards/domain";

import {
  getLocalDeviceIdentity,
  storeLocalDeviceIdentity,
  type LocalDeviceIdentity,
} from "./offline";

const textEncoder = new TextEncoder();

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

export function detectDevicePlatform(): DevicePlatform {
  const nativePlatform = (
    globalThis as typeof globalThis & {
      Capacitor?: {
        getPlatform?: () => string;
        isNativePlatform?: () => boolean;
      };
    }
  ).Capacitor;
  if (nativePlatform?.isNativePlatform?.()) {
    const platform = nativePlatform.getPlatform?.();
    if (platform === "ios") return "APPLE";
    if (platform === "android") return "ANDROID";
  }
  if (
    typeof navigator !== "undefined" &&
    /Windows/i.test(navigator.userAgent)
  ) {
    return "WINDOWS";
  }
  return "WEB";
}

const legacyDefaultDeviceNames = new Set([
  "Flash-n-Flip in this browser",
  "Flash-n-Flip on Apple",
  "Flash-n-Flip on Android",
  "Flash-n-Flip on Windows",
]);

export function recommendedDeviceName(input: {
  platform: DevicePlatform;
  userAgent?: string;
  maxTouchPoints?: number;
}): string {
  const userAgent = input.userAgent ?? "";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/iPhone|iPod/i.test(userAgent)) return "iPhone";
  if (
    /Macintosh|Mac OS X/i.test(userAgent) &&
    (input.maxTouchPoints ?? 0) > 1
  ) {
    return "iPad";
  }
  if (/Android/i.test(userAgent)) return "Android";
  if (/Windows/i.test(userAgent) || input.platform === "WINDOWS") {
    return "Windows PC";
  }
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "Mac";
  if (input.platform === "APPLE") return "Apple device";
  if (input.platform === "ANDROID") return "Android";
  return "Browser";
}

export function defaultDeviceName(platform: DevicePlatform): string {
  return recommendedDeviceName({
    platform,
    userAgent:
      typeof navigator === "undefined" ? undefined : navigator.userAgent,
    maxTouchPoints:
      typeof navigator === "undefined" ? undefined : navigator.maxTouchPoints,
  });
}

export function deviceCapabilities(
  platform: DevicePlatform,
): DeviceCapability[] {
  return [
    "PAIRING_V1",
    "WEBRTC_V1",
    "DECK_TRANSFER_V1",
    "PEER_SYNC_V1",
    ...(platform === "APPLE" || platform === "ANDROID"
      ? (["LAN_DISCOVERY_V1"] satisfies DeviceCapability[])
      : []),
  ];
}

export async function getOrCreateLocalDeviceIdentity(): Promise<LocalDeviceIdentity> {
  const stored = await getLocalDeviceIdentity();
  if (stored) {
    if (legacyDefaultDeviceNames.has(stored.displayName)) {
      const upgraded = {
        ...stored,
        displayName: defaultDeviceName(stored.platform),
      };
      await storeLocalDeviceIdentity(upgraded);
      return upgraded;
    }
    return stored;
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure device identity is unavailable in this browser");
  }
  const generated = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const [publicKeyBytes, privateKeyBytes] = await Promise.all([
    crypto.subtle.exportKey("spki", generated.publicKey),
    crypto.subtle.exportKey("pkcs8", generated.privateKey),
  ]);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const platform = detectDevicePlatform();
  const identity: LocalDeviceIdentity = {
    id: createId(),
    displayName: defaultDeviceName(platform),
    platform,
    publicKey: bytesToBase64Url(new Uint8Array(publicKeyBytes)),
    privateKey,
    createdAt: new Date().toISOString(),
  };
  await storeLocalDeviceIdentity(identity);
  return identity;
}

export type EphemeralPairingKey = {
  privateKey: CryptoKey;
  publicKey: string;
};

export async function createEphemeralPairingKey(): Promise<EphemeralPairingKey> {
  const generated = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("raw", generated.publicKey);
  return {
    privateKey: generated.privateKey,
    publicKey: bytesToBase64Url(new Uint8Array(publicKey)),
  };
}

export function createPairingSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

export async function automaticConnectionSecret(
  sessionId: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(`flash-n-flip:auto-device-connection:${sessionId}`),
  );
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function pairingProof(
  secret: string,
  value: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(base64UrlToBytes(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function pairingConfirmationCode(
  secret: string,
  firstPublicKey: string,
  secondPublicKey: string,
): Promise<string> {
  const proof = await pairingProof(
    secret,
    [firstPublicKey, secondPublicKey].sort().join(":"),
  );
  const bytes = base64UrlToBytes(proof);
  const value =
    (((bytes[0] ?? 0) << 16) | ((bytes[1] ?? 0) << 8) | (bytes[2] ?? 0)) %
    1_000_000;
  return String(value).padStart(6, "0");
}

export function encodePairingPayload(payload: PairingQrPayload): string {
  const parsed = pairingQrPayloadSchema.parse(payload);
  const encoded = bytesToBase64Url(textEncoder.encode(JSON.stringify(parsed)));
  return `${parsed.serverOrigin.replace(/\/$/, "")}/app/settings#pair=${encoded}`;
}

export function decodePairingPayload(value: string): PairingQrPayload {
  const url = value.includes("://")
    ? new URL(value)
    : new URL(`https://pair.invalid/#pair=${value}`);
  const encoded = new URLSearchParams(url.hash.slice(1)).get("pair");
  if (!encoded) throw new Error("Pairing code is invalid");
  const json = new TextDecoder().decode(base64UrlToBytes(encoded));
  return pairingQrPayloadSchema.parse(JSON.parse(json));
}
