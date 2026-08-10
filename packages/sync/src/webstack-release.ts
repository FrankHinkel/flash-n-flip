import {
  signedWebstackReleaseSchema,
  type SignedWebstackRelease,
  type WebstackManifest,
} from "@flashcards/domain/signed-webstack";
import {
  signedCuratedCatalogSchema,
  type CuratedCatalog,
} from "@flashcards/domain/curated-catalog";
import { curatedCatalogSchema } from "@flashcards/domain/curated-catalog";

const encoder = new TextEncoder();
const cryptoBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
  new Uint8Array(bytes);

export type TrustedWebstackSigningKeys = Readonly<Record<string, string>>;

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const webstackManifestBytes = (manifest: WebstackManifest): Uint8Array =>
  encoder.encode(canonicalJson(manifest));

export const curatedCatalogManifestBytes = (manifest: unknown): Uint8Array =>
  encoder.encode(canonicalJson(manifest));

const compareVersion = (left: string, right: string): number => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

export async function verifyWebstackRelease(input: {
  release: unknown;
  assets: ReadonlyMap<string, Uint8Array>;
  trustedKeys: TrustedWebstackSigningKeys;
  bootstrapVersion: string;
  currentAppVersion?: string;
}): Promise<SignedWebstackRelease> {
  const release = signedWebstackReleaseSchema.parse(input.release);
  const spkiBase64 = input.trustedKeys[release.manifest.signingKeyId];
  if (!spkiBase64) throw new Error("Webstack signing key is not trusted");
  if (
    compareVersion(
      input.bootstrapVersion,
      release.manifest.minimumBootstrapVersion,
    ) < 0
  ) {
    throw new Error("Webstack requires a newer bootstrap shell");
  }
  if (
    input.currentAppVersion &&
    compareVersion(release.manifest.appVersion, input.currentAppVersion) < 0
  ) {
    throw new Error("Webstack downgrade refused");
  }
  const publicKey = await crypto.subtle.importKey(
    "spki",
    cryptoBytes(base64ToBytes(spkiBase64)),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const signatureValid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    cryptoBytes(base64ToBytes(release.signatureBase64)),
    cryptoBytes(webstackManifestBytes(release.manifest)),
  );
  if (!signatureValid) throw new Error("Webstack release signature is invalid");

  const expectedPaths = new Set(
    release.manifest.assets.map((asset) => asset.path),
  );
  if (
    input.assets.size !== expectedPaths.size ||
    [...input.assets.keys()].some((path) => !expectedPaths.has(path))
  ) {
    throw new Error(
      "Webstack asset set is incomplete or contains unknown files",
    );
  }
  for (const asset of release.manifest.assets) {
    const bytes = input.assets.get(asset.path);
    if (!bytes || bytes.byteLength !== asset.byteSize) {
      throw new Error(`Webstack asset size mismatch: ${asset.path}`);
    }
    const digest = toHex(
      await crypto.subtle.digest("SHA-256", cryptoBytes(bytes)),
    );
    if (digest !== asset.sha256)
      throw new Error(`Webstack asset hash mismatch: ${asset.path}`);
  }
  return release;
}

export async function verifyCuratedCatalog(input: {
  catalogBytes: Uint8Array;
  signature: unknown;
  trustedKeys: TrustedWebstackSigningKeys;
  supportedGenerations: readonly number[];
}): Promise<CuratedCatalog> {
  const signed = signedCuratedCatalogSchema.parse(input.signature);
  const manifest = signed.manifest;
  if (!input.supportedGenerations.includes(manifest.generation)) {
    throw new Error("Curated catalog generation is not supported");
  }
  if (input.catalogBytes.byteLength !== manifest.byteSize) {
    throw new Error("Curated catalog size mismatch");
  }
  const digest = toHex(
    await crypto.subtle.digest("SHA-256", cryptoBytes(input.catalogBytes)),
  );
  if (digest !== manifest.sha256) {
    throw new Error("Curated catalog hash mismatch");
  }
  const spkiBase64 = input.trustedKeys[manifest.signingKeyId];
  if (!spkiBase64)
    throw new Error("Curated catalog signing key is not trusted");
  const publicKey = await crypto.subtle.importKey(
    "spki",
    cryptoBytes(base64ToBytes(spkiBase64)),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    cryptoBytes(base64ToBytes(signed.signatureBase64)),
    cryptoBytes(curatedCatalogManifestBytes(manifest)),
  );
  if (!valid) throw new Error("Curated catalog signature is invalid");
  return curatedCatalogSchema.parse(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(input.catalogBytes),
    ),
  );
}
