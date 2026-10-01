import { describe, expect, it, vi } from "vitest";
import { localBackupBlob, readLocalBackupFile } from "./local-backup-file";

const source = () => ({
  format: "flash-n-flip-local-backup",
  version: 3,
  exportedAt: "2026-10-02T08:00:00Z",
  authority: { label: "Grüße 🌻", escaped: '"\\{}[]' },
  media: [
    { dataBase64: "AQID", label: "one" },
    { dataBase64: "BAUG", label: "two" },
  ],
});
const collect = async (
  file: Blob,
  limits?: Parameters<typeof readLocalBackupFile>[1],
) => {
  const result = [];
  for await (const part of readLocalBackupFile(file, limits)) result.push(part);
  return result;
};

describe("bounded reading of existing JSON backup files", () => {
  it("reads fields and individual media without reading the whole blob", async () => {
    const backup = source();
    const file = new Blob([JSON.stringify(backup)]);
    const text = vi
      .spyOn(file, "text")
      .mockRejectedValue(new Error("whole-file text read"));
    const buffer = vi
      .spyOn(file, "arrayBuffer")
      .mockRejectedValue(new Error("whole-file byte read"));
    expect(await collect(file)).toEqual([
      ...Object.entries(backup)
        .filter(([key]) => key !== "media")
        .map(([key, value]) => ({ kind: "field", key, value })),
      ...backup.media.map((value) => ({ kind: "media", value })),
    ]);
    expect(text).not.toHaveBeenCalled();
    expect(buffer).not.toHaveBeenCalled();
  });
  it("accepts media first and arbitrary root-field order", async () => {
    const backup = source();
    const file = new Blob([
      JSON.stringify({
        media: [],
        authority: backup.authority,
        exportedAt: backup.exportedAt,
        version: 1,
        format: backup.format,
      }),
    ]);
    expect((await collect(file)).map((part) => part.kind)).toEqual([
      "field",
      "field",
      "field",
      "field",
    ]);
  });
  it("handles Unicode, escaped quotes and containers across 64 KiB reads", async () => {
    const backup = source();
    // Position a multi-byte character precisely across the first read boundary.
    const prefix = '{"authority":{"label":"';
    const label = "x".repeat(65_535 - prefix.length) + '🌻ä"\\{}[]';
    const file = new Blob([
      JSON.stringify({
        authority: { label },
        format: backup.format,
        media: backup.media,
        exportedAt: backup.exportedAt,
        version: 3,
      }),
    ]);
    expect((await collect(file))[0]).toEqual({
      kind: "field",
      key: "authority",
      value: { label },
    });
  });
  it.each([
    "",
    "[]",
    "null",
    "{}",
    '{"format":"x",}',
    '{"media":[1,]}',
    '{"media":{}}',
    '{"version":3,"version":2}',
    '{"unexpected":[]}',
    '{"authority":{"label":"unfinished}',
    '{"authority":[}',
    JSON.stringify(source()) + "null",
    JSON.stringify(source()).slice(0, -1),
  ])(
    "rejects malformed, duplicate, unknown and incomplete input: %s",
    async (json) => {
      await expect(collect(new Blob([json]))).rejects.toThrow();
    },
  );
  it("checks the total size before reading or staging any file content", async () => {
    const file = new Blob([JSON.stringify(source())]);
    const slice = vi.spyOn(file, "slice");
    await expect(collect(file, { maximumBytes: 10 })).rejects.toThrow(
      "zu groß",
    );
    expect(slice).not.toHaveBeenCalled();
  });
  it("bounds individual values and JSON nesting", async () => {
    await expect(
      collect(new Blob([JSON.stringify(source())]), { maximumValueChars: 8 }),
    ).rejects.toThrow("value limit");
    const nested =
      '{"authority":' + "[".repeat(129) + "0" + "]".repeat(129) + "}";
    await expect(collect(new Blob([nested]))).rejects.toThrow("nesting limit");
  });
  it("rejects malformed UTF-8 instead of silently repairing backup content", async () => {
    await expect(
      collect(new Blob([new Uint8Array([123, 34, 255, 34, 125])])),
    ).rejects.toThrow();
  });
  it("stops reading when the consumer cancels", async () => {
    const file = new Blob([
      JSON.stringify({
        ...source(),
        authority: { label: "x".repeat(150_000) },
      }),
    ]);
    const slice = vi.spyOn(file, "slice");
    const iterator = readLocalBackupFile(file);
    expect((await iterator.next()).value).toMatchObject({
      kind: "field",
      key: "format",
    });
    await iterator.return(undefined);
    expect(slice).toHaveBeenCalledOnce();
  });
  it("reassembles small export pieces with exact UTF-8 bytes and JSON MIME", async () => {
    const json = JSON.stringify(source());
    async function* pieces() {
      for (const part of [json.slice(0, 20), json.slice(20)]) yield part;
    }
    const blob = await localBackupBlob(pieces());
    expect(blob.type).toBe("application/json");
    expect(blob.size).toBe(new TextEncoder().encode(json).byteLength);
    expect(await blob.text()).toBe(json);
  });
});
