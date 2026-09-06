import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CloudRecordStore } from "./cloud-library.js";
import { CloudLibraryError } from "./cloud-library.js";
import {
  cloudAssetChunkBytes, cloudAssetRecordName, stageCloudAsset,
  uploadCloudAsset, verifyAssembledCloudAsset, type CloudAssetCodec,
} from "./cloud-library-assets.js";

const identity = {
  libraryId:"10000000-0000-4000-8000-000000000001",
  libraryGeneration:"10000000-0000-4000-8000-000000000002",
};
const codec: CloudAssetCodec = {
  hash: async bytes => createHash("sha256").update(bytes).digest("hex"),
  encode: bytes => Buffer.from(bytes).toString("base64"),
  decode: value => new Uint8Array(Buffer.from(value,"base64")),
};
async function fixture() {
  const bytes = new Uint8Array(cloudAssetChunkBytes + 7).fill(13);
  const chunks = [bytes.slice(0,cloudAssetChunkBytes),bytes.slice(cloudAssetChunkBytes)];
  const manifest = {
    sha256:await codec.hash(bytes),byteSize:bytes.byteLength,
    chunks:await Promise.all(chunks.map(async (chunk,index) => ({index,byteSize:chunk.byteLength,sha256:await codec.hash(chunk)}))),
  };
  const records = new Map<string,unknown>([["library.root.v1",{
    ...identity,protocolVersion:1,kind:"library-root",deleted:false,
  }]]);
  const store: CloudRecordStore = {
    read:vi.fn(async name => records.has(name) ? {value:records.get(name),changeTag:"1"} : null),
    compareAndSwap:vi.fn(async (name,tag,value) => {
      if (records.has(name) || tag !== null) throw new CloudLibraryError("WRITE_CONFLICT","exists");
      records.set(name,value);
    }),
  };
  const source = {manifest,readChunk:vi.fn(async (index:number) => chunks[index]!)};
  return {bytes,chunks,manifest,records,store,source,identity,codec};
}

describe("resumable immutable CloudKit assets", () => {
  it("uploads verified chunks and does not upload them again on retry", async () => {
    const f = await fixture(); await uploadCloudAsset(f); await uploadCloudAsset(f);
    expect(f.store.compareAndSwap).toHaveBeenCalledTimes(2);
    expect(f.source.readChunk).toHaveBeenCalledTimes(2);
    expect(f.records.size).toBe(3);
  });

  it("recovers after the cloud saved a chunk but its response was lost", async () => {
    const f = await fixture(); const save = f.store.compareAndSwap;
    f.store.compareAndSwap = vi.fn(async (...args) => {
      await save(...args); if (f.records.size === 2) throw new Error("connection lost");
    });
    await expect(uploadCloudAsset(f)).rejects.toThrow("connection lost");
    await uploadCloudAsset(f);
    expect(f.records.size).toBe(3);
    expect(f.source.readChunk).toHaveBeenCalledTimes(2);
  });

  it("converges concurrent uploads through create-only writes", async () => {
    const f = await fixture();
    await Promise.all([uploadCloudAsset(f),uploadCloudAsset(f)]);
    expect(f.records.size).toBe(3);
  });

  it("resumes staging after interruption without downloading valid chunks again", async () => {
    const f = await fixture(); await uploadCloudAsset(f);
    const local = new Map<number,Uint8Array>();
    const staging = {
      readChunk:async (index:number) => local.get(index) ?? null,
      writeChunk:vi.fn(async (index:number,bytes:Uint8Array) => {
        if(index === 1 && local.size === 1) throw new Error("disk interrupted");
        local.set(index,bytes);
      }),
    };
    await expect(stageCloudAsset({...f,staging})).rejects.toThrow("disk interrupted");
    staging.writeChunk.mockImplementation(async (index,bytes) => { local.set(index,bytes); });
    vi.mocked(f.store.read).mockClear();
    await stageCloudAsset({...f,staging});
    expect(f.store.read).not.toHaveBeenCalledWith(cloudAssetRecordName(identity,f.manifest.sha256,0));
    const combined = new Uint8Array(f.bytes.length);
    combined.set(local.get(0)!); combined.set(local.get(1)!,cloudAssetChunkBytes);
    await expect(verifyAssembledCloudAsset(combined,f.manifest,codec)).resolves.toBeUndefined();
  });

  it("does not overwrite corrupted remote bytes or accept a missing chunk", async () => {
    const f = await fixture(); await uploadCloudAsset(f);
    const name = cloudAssetRecordName(identity,f.manifest.sha256,0);
    f.records.set(name,{...(f.records.get(name) as object),data:"corrupt"});
    await expect(uploadCloudAsset(f)).rejects.toThrow("checksum");
    f.records.delete(name);
    const staging = {readChunk:async () => null,writeChunk:vi.fn()};
    await expect(stageCloudAsset({...f,staging})).rejects.toThrow("incomplete");
    expect(staging.writeChunk).not.toHaveBeenCalled();
  });

  it("refuses source corruption before sending the first byte", async () => {
    const f = await fixture(); f.source.readChunk.mockResolvedValue(new Uint8Array(1));
    await expect(uploadCloudAsset(f)).rejects.toThrow("corrupt");
    expect(f.store.compareAndSwap).not.toHaveBeenCalled();
  });

  it.each([null,{...identity,libraryGeneration:"20000000-0000-4000-8000-000000000002",protocolVersion:1,kind:"library-root",deleted:false}])(
    "stops when the library root disappears or changes", async changed => {
      const f = await fixture();
      if(changed) f.records.set("library.root.v1",changed); else f.records.delete("library.root.v1");
      await expect(uploadCloudAsset(f)).rejects.toThrow("preserve local data");
      expect(f.store.compareAndSwap).not.toHaveBeenCalled();
    });

  it("checks the complete content hash before an importer may install bytes", async () => {
    const f = await fixture();
    await expect(verifyAssembledCloudAsset(new Uint8Array(f.bytes.length),f.manifest,codec)).rejects.toThrow("checksum");
  });
});
