import { describe, expect, it, vi } from "vitest";

import { NativeSqliteLocalMediaStorage } from "./media-storage";

describe("native SQLite media adapter", () => {
  it("retains original bytes losslessly and binds all SQL values", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        values: [
          {
            media_id: "00000000-0000-4000-8000-000000000501",
            mime_type: "audio/wav",
            sha256: "a".repeat(64),
            data_base64: "AP+AQA==",
          },
        ],
      }),
    };
    const storage = new NativeSqliteLocalMediaStorage(sqlite, "media-test");
    const bytes = new Uint8Array([0, 255, 128, 64]);
    await storage.put({
      mediaId: "00000000-0000-4000-8000-000000000501",
      mimeType: "audio/wav",
      sha256: "a".repeat(64),
      bytes,
    });
    const restored = await storage.get("00000000-0000-4000-8000-000000000501");

    expect(restored?.bytes).toEqual(bytes);
    expect(sqlite.run).toHaveBeenCalledWith(
      expect.objectContaining({
        values: [
          "00000000-0000-4000-8000-000000000501",
          "audio/wav",
          "a".repeat(64),
          "AP+AQA==",
        ],
      }),
    );
    expect(sqlite.query).toHaveBeenCalledWith(
      expect.objectContaining({
        values: ["00000000-0000-4000-8000-000000000501"],
      }),
    );
  });

  it("persists and clears resumable peer chunks with bound values", async () => {
    const sqlite = {
      createConnection: vi.fn().mockResolvedValue(undefined),
      isDBOpen: vi.fn().mockResolvedValue({ result: true }),
      open: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        values: [
          {
            media_id: "00000000-0000-4000-8000-000000000502",
            chunk_index: 1,
            chunk_count: 2,
            sha256: "b".repeat(64),
            mime_type: "audio/wav",
            byte_size: 4,
            data_base64: "AwQ=",
          },
        ],
      }),
    };
    const storage = new NativeSqliteLocalMediaStorage(sqlite, "media-chunks");
    await storage.putChunk({
      mediaId: "00000000-0000-4000-8000-000000000502",
      index: 1,
      chunkCount: 2,
      sha256: "b".repeat(64),
      mimeType: "audio/wav",
      byteSize: 4,
      bytes: new Uint8Array([3, 4]),
    });
    expect(
      await storage.listChunks("00000000-0000-4000-8000-000000000502"),
    ).toEqual([
      expect.objectContaining({ index: 1, bytes: new Uint8Array([3, 4]) }),
    ]);
    await storage.deleteChunks("00000000-0000-4000-8000-000000000502");
    expect(sqlite.run).toHaveBeenLastCalledWith(
      expect.objectContaining({
        values: ["00000000-0000-4000-8000-000000000502"],
      }),
    );
  });
});
