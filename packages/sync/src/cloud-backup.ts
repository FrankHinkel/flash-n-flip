import {
  encryptedCloudBackupEnvelopeSchema,
  type EncryptedCloudBackupEnvelope,
} from "@flashcards/domain/cloud-backup";
import {
  localAppBackupEnvelopeSchema,
  type LocalAppBackupEnvelope,
} from "@flashcards/domain/local-app-data";

const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 512 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const cryptoBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(bytes);

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (bytes: Uint8Array): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", cryptoBytes(bytes)));

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
};

const requireRecoveryKey = (recoveryKey: Uint8Array): void => {
  if (recoveryKey.byteLength !== 32) {
    throw new Error("Cloud backup recovery key must contain exactly 32 bytes");
  }
};

const deriveKeys = async (
  recoveryKey: Uint8Array,
  backupId: string,
): Promise<{ encryption: CryptoKey; manifestMac: CryptoKey }> => {
  requireRecoveryKey(recoveryKey);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    cryptoBytes(recoveryKey),
    "HKDF",
    false,
    ["deriveKey"],
  );
  const derive = (
    info: string,
    algorithm: AesKeyGenParams | HmacImportParams,
  ) =>
    crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: cryptoBytes(encoder.encode(backupId)),
        info: cryptoBytes(encoder.encode(info)),
      },
      keyMaterial,
      algorithm,
      false,
      algorithm.name === "HMAC" ? ["sign", "verify"] : ["encrypt", "decrypt"],
    );
  return {
    encryption: await derive("flash-n-flip-cloud-backup-encryption-v1", {
      name: "AES-GCM",
      length: 256,
    }),
    manifestMac: await derive("flash-n-flip-cloud-backup-manifest-v1", {
      name: "HMAC",
      hash: "SHA-256",
      length: 256,
    }),
  };
};

const authenticatedManifest = (
  manifest: Omit<EncryptedCloudBackupEnvelope["manifest"], "manifestMac">,
  chunks: EncryptedCloudBackupEnvelope["chunks"],
): Uint8Array =>
  encoder.encode(
    canonicalJson({
      manifest,
      chunks: chunks.map(
        ({ ciphertextBase64: _ciphertext, ...chunk }) => chunk,
      ),
    }),
  );

const chunkAad = (
  backupId: string,
  index: number,
  chunkCount: number,
  payloadSha256: string,
): Uint8Array =>
  encoder.encode(canonicalJson({ backupId, chunkCount, index, payloadSha256 }));

export async function createEncryptedCloudBackup(input: {
  backup: LocalAppBackupEnvelope;
  sourceDeviceId: string;
  recoveryKey: Uint8Array;
  chunkSize?: number;
  backupId?: string;
  createdAt?: string;
}): Promise<EncryptedCloudBackupEnvelope> {
  const backup = localAppBackupEnvelopeSchema.parse(input.backup);
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (
    !Number.isSafeInteger(chunkSize) ||
    chunkSize < 64 * 1024 ||
    chunkSize > 4 * 1024 * 1024
  ) {
    throw new Error("Cloud backup chunk size must be between 64 KiB and 4 MiB");
  }
  const plaintext = encoder.encode(JSON.stringify(backup));
  if (
    plaintext.byteLength === 0 ||
    plaintext.byteLength > MAX_PLAINTEXT_BYTES
  ) {
    throw new Error("Cloud backup payload exceeds the 512 MiB safety limit");
  }
  const backupId = input.backupId ?? crypto.randomUUID();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const payloadSha256 = await sha256(plaintext);
  const chunkCount = Math.ceil(plaintext.byteLength / chunkSize);
  const keys = await deriveKeys(input.recoveryKey, backupId);
  const chunks: EncryptedCloudBackupEnvelope["chunks"] = [];

  for (let index = 0; index < chunkCount; index += 1) {
    const cleartext = plaintext.subarray(
      index * chunkSize,
      (index + 1) * chunkSize,
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: cryptoBytes(
            chunkAad(backupId, index, chunkCount, payloadSha256),
          ),
          tagLength: 128,
        },
        keys.encryption,
        cryptoBytes(cleartext),
      ),
    );
    chunks.push({
      index,
      ivBase64: bytesToBase64(iv),
      ciphertextBase64: bytesToBase64(ciphertext),
      ciphertextSha256: await sha256(ciphertext),
      byteSize: ciphertext.byteLength,
    });
  }

  const unsignedManifest = {
    format: "flash-n-flip-encrypted-cloud-backup" as const,
    version: 1 as const,
    backupId,
    createdAt,
    sourceDeviceId: input.sourceDeviceId,
    payloadSha256,
    plaintextBytes: plaintext.byteLength,
    chunkSize,
    chunkCount,
    keyDerivation: "HKDF-SHA256" as const,
    encryption: "AES-256-GCM" as const,
  };
  const manifestMac = toHex(
    await crypto.subtle.sign(
      "HMAC",
      keys.manifestMac,
      cryptoBytes(authenticatedManifest(unsignedManifest, chunks)),
    ),
  );
  return encryptedCloudBackupEnvelopeSchema.parse({
    manifest: { ...unsignedManifest, manifestMac },
    chunks,
  });
}

export async function decryptCloudBackup(
  candidate: unknown,
  recoveryKey: Uint8Array,
): Promise<LocalAppBackupEnvelope> {
  const envelope = encryptedCloudBackupEnvelopeSchema.parse(candidate);
  const { manifestMac, ...unsignedManifest } = envelope.manifest;
  const keys = await deriveKeys(recoveryKey, envelope.manifest.backupId);

  for (const chunk of envelope.chunks) {
    const ciphertext = base64ToBytes(chunk.ciphertextBase64);
    if (
      ciphertext.byteLength !== chunk.byteSize ||
      (await sha256(ciphertext)) !== chunk.ciphertextSha256
    ) {
      throw new Error(`Encrypted cloud backup chunk ${chunk.index} is corrupt`);
    }
  }
  const validMac = await crypto.subtle.verify(
    "HMAC",
    keys.manifestMac,
    cryptoBytes(
      Uint8Array.from(manifestMac.match(/.{2}/g) ?? [], (byte) =>
        parseInt(byte, 16),
      ),
    ),
    cryptoBytes(authenticatedManifest(unsignedManifest, envelope.chunks)),
  );
  if (!validMac)
    throw new Error("Encrypted cloud backup manifest is not authentic");

  const plaintext = new Uint8Array(envelope.manifest.plaintextBytes);
  let offset = 0;
  for (const chunk of envelope.chunks) {
    let cleartext: Uint8Array;
    try {
      cleartext = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: cryptoBytes(base64ToBytes(chunk.ivBase64)),
            additionalData: cryptoBytes(
              chunkAad(
                envelope.manifest.backupId,
                chunk.index,
                envelope.manifest.chunkCount,
                envelope.manifest.payloadSha256,
              ),
            ),
            tagLength: 128,
          },
          keys.encryption,
          cryptoBytes(base64ToBytes(chunk.ciphertextBase64)),
        ),
      );
    } catch {
      throw new Error(
        `Encrypted cloud backup chunk ${chunk.index} cannot be authenticated`,
      );
    }
    if (offset + cleartext.byteLength > plaintext.byteLength) {
      throw new Error("Encrypted cloud backup plaintext length is invalid");
    }
    plaintext.set(cleartext, offset);
    offset += cleartext.byteLength;
  }
  if (
    offset !== plaintext.byteLength ||
    (await sha256(plaintext)) !== envelope.manifest.payloadSha256
  ) {
    throw new Error("Encrypted cloud backup payload hash mismatch");
  }
  return localAppBackupEnvelopeSchema.parse(
    JSON.parse(decoder.decode(plaintext)),
  );
}
