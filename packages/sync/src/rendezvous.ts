import {
  directSyncInvitationSchema,
  encryptedRendezvousMessageSchema,
  phaseOneSnapshotSchema,
} from "@flashcards/domain/rendezvous";
import type {
  DirectSyncInvitation,
  EncryptedRendezvousMessage,
  PhaseOneSnapshot,
  RendezvousSignal,
} from "@flashcards/domain/rendezvous";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

export const createRendezvousCapability = (): string =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));

export const rendezvousCapabilityHash = async (
  capability: string,
): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(capability),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export type RendezvousSecrets = {
  initiatorCapability: string;
  joinerCapability: string;
  encryptionKey: string;
};

export const createRendezvousSecrets = (): RendezvousSecrets => ({
  initiatorCapability: createRendezvousCapability(),
  joinerCapability: createRendezvousCapability(),
  encryptionKey: createRendezvousCapability(),
});

export const encodeDirectSyncInvitation = (
  invitation: DirectSyncInvitation,
): string => {
  const parsed = directSyncInvitationSchema.parse(invitation);
  return bytesToBase64Url(textEncoder.encode(JSON.stringify(parsed)));
};

export const decodeDirectSyncInvitation = (
  encoded: string,
): DirectSyncInvitation => {
  if (encoded.length > 4_096) throw new Error("Invitation is too large");
  return directSyncInvitationSchema.parse(
    JSON.parse(textDecoder.decode(base64UrlToBytes(encoded.trim()))),
  );
};

const importRendezvousKey = async (encoded: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    asArrayBuffer(base64UrlToBytes(encoded)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );

const rendezvousAdditionalData = (
  sessionId: string,
  messageId: string,
): Uint8Array =>
  textEncoder.encode(`flash-n-flip:rendezvous:v1:${sessionId}:${messageId}`);

export const encryptRendezvousMessage = async (input: {
  sessionId: string;
  encryptionKey: string;
  message: EncryptedRendezvousMessage;
}): Promise<string> => {
  const message = encryptedRendezvousMessageSchema.parse(input.message);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(nonce),
      additionalData: asArrayBuffer(
        rendezvousAdditionalData(input.sessionId, message.messageId),
      ),
      tagLength: 128,
    },
    await importRendezvousKey(input.encryptionKey),
    textEncoder.encode(JSON.stringify(message)),
  );
  const envelope = new Uint8Array(nonce.byteLength + ciphertext.byteLength);
  envelope.set(nonce);
  envelope.set(new Uint8Array(ciphertext), nonce.byteLength);
  return bytesToBase64Url(envelope);
};

export const decryptRendezvousSignal = async (input: {
  sessionId: string;
  encryptionKey: string;
  signal: RendezvousSignal;
}): Promise<EncryptedRendezvousMessage> => {
  const envelope = base64UrlToBytes(input.signal.encryptedPayload);
  if (envelope.byteLength < 29) {
    throw new Error("Encrypted rendezvous signal is too short");
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(envelope.subarray(0, 12)),
      additionalData: asArrayBuffer(
        rendezvousAdditionalData(input.sessionId, input.signal.messageId),
      ),
      tagLength: 128,
    },
    await importRendezvousKey(input.encryptionKey),
    asArrayBuffer(envelope.subarray(12)),
  );
  const message = encryptedRendezvousMessageSchema.parse(
    JSON.parse(textDecoder.decode(plaintext)),
  );
  if (message.messageId !== input.signal.messageId) {
    throw new Error("Rendezvous message identifier mismatch");
  }
  return message;
};

export interface PhaseOneSnapshotStore {
  saveSnapshot(snapshot: PhaseOneSnapshot): Promise<"INSERTED" | "DUPLICATE">;
  loadSnapshot(): Promise<PhaseOneSnapshot | null>;
}

export const persistPhaseOneSnapshot = async (
  store: PhaseOneSnapshotStore,
  candidate: unknown,
): Promise<"INSERTED" | "DUPLICATE"> =>
  store.saveSnapshot(phaseOneSnapshotSchema.parse(candidate));
