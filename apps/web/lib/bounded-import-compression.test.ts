import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  checkZipExpansion,
  checkZipDirectory,
  decompressBoundedZstd,
  readBoundedZipEntry,
} from "./bounded-import-compression";

async function zipEntry(text: string) {
  const zip = new JSZip();
  zip.file("payload", text);
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  const loaded = await JSZip.loadAsync(bytes);
  return loaded.file("payload")!;
}

// A standard frame with one raw or RLE block, no third-party compressor needed.
function frame(size: number, value = 65, declaredSize = size): Uint8Array {
  const header = (size << 3) | 3; // final RLE block
  return Uint8Array.from([
    0x28,
    0xb5,
    0x2f,
    0xfd,
    0xa0,
    declaredSize & 255,
    (declaredSize >>> 8) & 255,
    (declaredSize >>> 16) & 255,
    declaredSize >>> 24,
    header & 255,
    (header >>> 8) & 255,
    header >>> 16,
    value,
  ]);
}
const concatenate = (...parts: Uint8Array[]) =>
  Uint8Array.from(parts.flatMap((part) => [...part]));

describe("bounded import decompression", () => {
  it("bounds the directory before loading entries and rejects duplicate raw names", async () => {
    const zip = new JSZip();
    zip.file("a", "A");
    zip.file("b", "B");
    const bytes = await zip.generateAsync({ type: "uint8array" });
    checkZipDirectory(bytes, 2, 2);
    expect(() => checkZipDirectory(bytes, 2, 1)).toThrow("zu groß");
    expect(() => checkZipDirectory(bytes, 1, 2)).toThrow("Sicherheitsgrenze");
    const duplicate = bytes.slice();
    const view = new DataView(duplicate.buffer);
    const directory = view.getUint32(duplicate.length - 6, true);
    duplicate[directory + 47 + 46] = 97; // second central name becomes 'a'
    expect(() => checkZipDirectory(duplicate, 2, 2)).toThrow(
      "doppelte Dateinamen",
    );
    expect(() => checkZipDirectory(new Uint8Array(1), 2, 2)).toThrow(
      "ZIP-Verzeichnis",
    );
  });
  it("extracts a compressed ZIP and verifies its checksum at the size boundary", async () => {
    const entry = await zipEntry("A".repeat(4096));
    checkZipExpansion([entry], 4096);
    expect(await readBoundedZipEntry(entry, 4096)).toEqual(
      new TextEncoder().encode("A".repeat(4096)),
    );
    expect(() => checkZipExpansion([entry], 4095)).toThrow("Sicherheitsgrenze");
    expect(() => checkZipExpansion([entry, entry], 5000)).toThrow(
      "Sicherheitsgrenze",
    );
  });

  it("stops inflated output even if a forged directory understates its size", async () => {
    const entry = await zipEntry("B".repeat(4096));
    (
      entry as unknown as { _data: { uncompressedSize: number } }
    )._data.uncompressedSize = 10;
    await expect(readBoundedZipEntry(entry, 100)).rejects.toThrow(
      "Sicherheitsgrenze",
    );
  });

  it("rejects corrupted ZIP checksums and cancelled extraction", async () => {
    const entry = await zipEntry("checksum");
    (entry as unknown as { _data: { crc32: number } })._data.crc32 = 0;
    await expect(readBoundedZipEntry(entry, 100)).rejects.toThrow("Prüfsumme");
    const controller = new AbortController();
    controller.abort();
    await expect(
      readBoundedZipEntry(await zipEntry("cancelled"), 100, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("decodes standard and concatenated Zstandard frames within the shared budget", () => {
    expect(decompressBoundedZstd(frame(100), 100)).toEqual(
      new Uint8Array(100).fill(65),
    );
    expect(
      decompressBoundedZstd(concatenate(frame(40, 65), frame(60, 66)), 100),
    ).toEqual(
      concatenate(new Uint8Array(40).fill(65), new Uint8Array(60).fill(66)),
    );
    expect(() =>
      decompressBoundedZstd(concatenate(frame(60), frame(60)), 100),
    ).toThrow("Sicherheitsgrenze");
  });

  it("rejects oversized history windows and frame allocations before decoding", () => {
    expect(() =>
      decompressBoundedZstd(frame(1, 65, 256 * 1024 * 1024), 1024),
    ).toThrow("Sicherheitsgrenze");
    const unknownSizeFrame = Uint8Array.from([
      0x28, 0xb5, 0x2f, 0xfd, 0, 0xf8, 3, 0, 0, 65,
    ]);
    expect(() => decompressBoundedZstd(unknownSizeFrame, 1024)).toThrow(
      "Sicherheitsgrenze",
    );
    expect(() =>
      decompressBoundedZstd(concatenate(frame(1), unknownSizeFrame), 1024),
    ).toThrow("Sicherheitsgrenze");
  });

  it("bounds actual Zstandard output when the frame lies about its decoded size", () => {
    expect(() => decompressBoundedZstd(frame(100, 65, 1), 50)).toThrow(
      "Sicherheitsgrenze",
    );
    expect(() =>
      decompressBoundedZstd(frame(100).subarray(0, 12), 100),
    ).toThrow("Unvollständige");
  });

  it("accepts skippable metadata frames followed by a standard frame", () => {
    const metadata = Uint8Array.from([
      0x50, 0x2a, 0x4d, 0x18, 2, 0, 0, 0, 11, 22,
    ]);
    expect(decompressBoundedZstd(concatenate(metadata, frame(3)), 100)).toEqual(
      new Uint8Array(3).fill(65),
    );
  });
});
