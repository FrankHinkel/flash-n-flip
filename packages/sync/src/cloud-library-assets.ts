import {
  cloudAssetManifestSchema,
  cloudLibraryIdentitySchema,
  cloudLibraryRootSchema,
  type CloudAssetManifest,
  type CloudLibraryIdentity,
} from "@flashcards/domain/cloud-library";
import { CloudLibraryError, type CloudRecordStore } from "./cloud-library.js";
import { cloudLibraryRootRecordName } from "./cloud-library-bootstrap.js";

// Base64 + JSON stays below the existing 200 KiB CloudKit metadata limit.
// The codec and digest are injected; this module has no browser/native APIs.
export const cloudAssetChunkBytes = 128 * 1024;
export interface CloudAssetCodec {
  hash(bytes: Uint8Array): Promise<string>;
  encode(bytes: Uint8Array): string;
  decode(base64: string): Uint8Array;
}
export interface CloudAssetSource {
  manifest: CloudAssetManifest;
  readChunk(index: number): Promise<Uint8Array>;
}

export const cloudAssetRecordName = (
  identity: CloudLibraryIdentity, digest: string, index: number,
): string => `asset.${identity.libraryId}.${identity.libraryGeneration}.${digest}.${index}`;

function validateManifest(candidate: CloudAssetManifest): CloudAssetManifest {
  const manifest = cloudAssetManifestSchema.parse(candidate);
  if (manifest.chunks.some((chunk, index) =>
    chunk.byteSize > cloudAssetChunkBytes ||
    (index < manifest.chunks.length - 1 && chunk.byteSize !== cloudAssetChunkBytes))) {
    throw new Error("Unsupported cloud asset chunk layout");
  }
  return manifest;
}

export async function assertCloudAssetRoot(
  store: CloudRecordStore, candidate: CloudLibraryIdentity,
): Promise<void> {
  const identity = cloudLibraryIdentitySchema.parse(candidate);
  const record = await store.read(cloudLibraryRootRecordName);
  if (!record) throw new Error("Cloud library is missing; preserve local data");
  const root = cloudLibraryRootSchema.parse(record.value);
  if (root.deleted || root.libraryId !== identity.libraryId ||
      root.libraryGeneration !== identity.libraryGeneration) {
    throw new Error("Cloud library generation changed; preserve local data");
  }
}

function chunkRecord(identity: CloudLibraryIdentity, manifest: CloudAssetManifest,
  index: number, data: string) {
  return {
    kind: "asset-chunk", protocolVersion: 1, ...identity,
    assetSha256: manifest.sha256, index,
    sha256: manifest.chunks[index]!.sha256,
    byteSize: manifest.chunks[index]!.byteSize,
    data,
  };
}

async function decodeChunk(value: unknown, identity: CloudLibraryIdentity,
  manifest: CloudAssetManifest, index: number, codec: CloudAssetCodec): Promise<Uint8Array> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid cloud chunk");
  const record = value as Record<string, unknown>;
  const descriptor = manifest.chunks[index]!;
  const expected = chunkRecord(identity, manifest, index, "");
  if (Object.keys(record).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([key, expectedValue]) => key !== "data" && record[key] !== expectedValue) ||
      typeof record.data !== "string" || record.data.length > Math.ceil(cloudAssetChunkBytes / 3) * 4) {
    throw new Error("Cloud chunk identity or size mismatch");
  }
  const bytes = codec.decode(record.data);
  if (bytes.byteLength !== descriptor.byteSize || await codec.hash(bytes) !== descriptor.sha256) {
    throw new Error("Cloud chunk checksum mismatch");
  }
  return bytes;
}

// Existing verified chunks are the upload checkpoint. A failed operation never
// deletes source bytes, acknowledges a learner outbox, or publishes a deck.
export async function uploadCloudAsset(input: {
  store: CloudRecordStore; identity: CloudLibraryIdentity;
  source: CloudAssetSource; codec: CloudAssetCodec;
}): Promise<void> {
  const {store, source, codec} = input;
  const identity = cloudLibraryIdentitySchema.parse(input.identity);
  const manifest = validateManifest(source.manifest);
  for (const descriptor of manifest.chunks) {
    await assertCloudAssetRoot(store, identity);
    const name = cloudAssetRecordName(identity, manifest.sha256, descriptor.index);
    const existing = await store.read(name);
    if (existing) {
      await decodeChunk(existing.value, identity, manifest, descriptor.index, codec);
      continue;
    }
    const bytes = await source.readChunk(descriptor.index);
    if (bytes.byteLength !== descriptor.byteSize || await codec.hash(bytes) !== descriptor.sha256) {
      throw new Error("Local asset changed or is corrupt");
    }
    const record = chunkRecord(identity, manifest, descriptor.index, codec.encode(bytes));
    // Validate codecs before persisting an immutable record that cannot be repaired
    // with an unconditional overwrite on a later run.
    await decodeChunk(record, identity, manifest, descriptor.index, codec);
    try {
      await store.compareAndSwap(name, null, record);
    } catch (error) {
      if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error;
    }
    const saved = await store.read(name);
    if (!saved) throw new Error("Cloud chunk write was not confirmed");
    await decodeChunk(saved.value, identity, manifest, descriptor.index, codec);
  }
  await assertCloudAssetRoot(store, identity);
}

// A platform sink commits chunks durably in a staging area and can reopen them
// after a restart. Nothing becomes visible as installed media in this function.
export interface CloudAssetStaging {
  readChunk(index: number): Promise<Uint8Array | null>;
  writeChunk(index: number, bytes: Uint8Array): Promise<void>;
}

export async function stageCloudAsset(input: {
  store: CloudRecordStore; identity: CloudLibraryIdentity;
  manifest: CloudAssetManifest; codec: CloudAssetCodec; staging: CloudAssetStaging;
}): Promise<void> {
  const {store, codec, staging} = input;
  const identity = cloudLibraryIdentitySchema.parse(input.identity);
  const manifest = validateManifest(input.manifest);
  for (const descriptor of manifest.chunks) {
    await assertCloudAssetRoot(store, identity);
    const local = await staging.readChunk(descriptor.index);
    if (local?.byteLength === descriptor.byteSize && await codec.hash(local) === descriptor.sha256) continue;
    const remote = await store.read(cloudAssetRecordName(identity, manifest.sha256, descriptor.index));
    if (!remote) throw new Error("Cloud asset is incomplete");
    const bytes = await decodeChunk(remote.value, identity, manifest, descriptor.index, codec);
    await staging.writeChunk(descriptor.index, bytes);
  }
  await assertCloudAssetRoot(store, identity);
}

// The owning importer verifies the aggregate content hash using a streaming
// digest before installation. This helper performs that final check for bounded
// in-memory files without reconstructing or mutating any learning repository.
export async function verifyAssembledCloudAsset(
  bytes: Uint8Array, candidate: CloudAssetManifest, codec: CloudAssetCodec,
): Promise<void> {
  const manifest = validateManifest(candidate);
  if (bytes.byteLength !== manifest.byteSize || await codec.hash(bytes) !== manifest.sha256) {
    throw new Error("Assembled cloud asset checksum mismatch");
  }
}
