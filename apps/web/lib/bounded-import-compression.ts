import { Decompress } from "fzstd";
import type JSZip from "jszip";

const limitError = () =>
  new Error("Das entpackte Archiv überschreitet die Sicherheitsgrenze.");

export function checkZipDirectory(
  bytes: Uint8Array,
  maximumBytes: number,
  maximumEntries: number,
): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  const earliestEnd = Math.max(0, end - 65535);
  while (
    end >= earliestEnd &&
    (view.getUint32(end, true) !== 0x06054b50 ||
      end + 22 + view.getUint16(end + 20, true) !== bytes.length)
  )
    end--;
  if (end < earliestEnd || end < 0)
    throw new Error("Ungültiges ZIP-Verzeichnis.");
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let cursor = view.getUint32(end + 16, true);
  const directoryEnd = cursor + directorySize;
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== count ||
    count === 65535 ||
    count > maximumEntries ||
    directoryEnd !== end
  )
    throw new Error("Das ZIP-Verzeichnis ist nicht unterstützt oder zu groß.");
  const names = new Set<string>();
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (
      cursor + 46 > directoryEnd ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error("Ungültiges ZIP-Verzeichnis.");
    total += view.getUint32(cursor + 24, true);
    if (total > maximumBytes) throw limitError();
    const nameSize = view.getUint16(cursor + 28, true);
    const entrySize =
      46 +
      nameSize +
      view.getUint16(cursor + 30, true) +
      view.getUint16(cursor + 32, true);
    if (!nameSize || nameSize > 2048 || cursor + entrySize > directoryEnd)
      throw new Error("Ungültiger ZIP-Dateiname.");
    const name = Array.from(
      bytes.subarray(cursor + 46, cursor + 46 + nameSize),
      (byte) => String.fromCharCode(byte),
    ).join("");
    if (names.has(name))
      throw new Error("Das Archiv enthält doppelte Dateinamen.");
    names.add(name);
    cursor += entrySize;
  }
  if (cursor !== directoryEnd) throw new Error("Ungültiges ZIP-Verzeichnis.");
}

// JSZip 3.10.1 exposes these central-directory fields on loaded entries.
// Keep this dependency isolated and fail closed if an upgrade changes it.
function zipMetadata(entry: JSZip.JSZipObject): {
  uncompressedSize: number;
  crc32: number;
} {
  const metadata = (
    entry as unknown as {
      _data?: { uncompressedSize?: unknown; crc32?: unknown };
    }
  )._data;
  if (
    !metadata ||
    !Number.isSafeInteger(metadata.uncompressedSize) ||
    Number(metadata.uncompressedSize) < 0 ||
    !Number.isInteger(metadata.crc32)
  )
    throw new Error("Ungültige ZIP-Metadaten.");
  return metadata as { uncompressedSize: number; crc32: number };
}

export function checkZipExpansion(
  entries: readonly JSZip.JSZipObject[],
  maximum: number,
): void {
  let total = 0;
  for (const entry of entries) {
    total += zipMetadata(entry).uncompressedSize;
    if (total > maximum) throw limitError();
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

export function readBoundedZipEntry(
  entry: JSZip.JSZipObject,
  maximum: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const metadata = zipMetadata(entry);
  if (metadata.uncompressedSize > maximum) return Promise.reject(limitError());
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let crc = 0xffffffff;
    let stopped = false;
    const stream = (
      entry as JSZip.JSZipObject & {
        internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
      }
    ).internalStream("uint8array");
    const fail = (error: unknown) => {
      stopped = true;
      stream.pause();
      chunks.length = 0;
      signal?.removeEventListener("abort", abort);
      reject(error);
    };
    const abort = () =>
      fail(new DOMException("Import abgebrochen", "AbortError"));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    stream.on("data", (chunk) => {
      if (stopped) return;
      size += chunk.length;
      if (size > maximum || size > metadata.uncompressedSize) {
        fail(limitError());
        return;
      }
      for (const byte of chunk)
        crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
      chunks.push(chunk);
    });
    stream.on("error", fail);
    stream.on("end", () => {
      if (stopped) return;
      signal?.removeEventListener("abort", abort);
      if (
        size !== metadata.uncompressedSize ||
        (crc ^ 0xffffffff) >>> 0 !== metadata.crc32 >>> 0
      ) {
        fail(new Error("Ungültige ZIP-Prüfsumme oder Dateigröße."));
        return;
      }
      const result = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(result);
    });
    stream.resume();
  });
}

// Validate every frame before fzstd allocates its history window. Traversing
// block headers also covers concatenated and skippable Zstandard frames.
function checkZstdWindows(bytes: Uint8Array, maximum: number): void {
  let cursor = 0;
  let declaredTotal = 0;
  const read = (count: number): number => {
    if (cursor + count > bytes.length)
      throw new Error("Unvollständige Zstandard-Daten.");
    let value = 0;
    for (let index = 0; index < count; index++)
      value += bytes[cursor++]! * 2 ** (8 * index);
    if (!Number.isSafeInteger(value)) throw limitError();
    return value;
  };
  const skip = (count: number) => {
    if (cursor + count > bytes.length)
      throw new Error("Unvollständige Zstandard-Daten.");
    cursor += count;
  };
  while (cursor < bytes.length) {
    const magic = read(4);
    if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) {
      skip(read(4));
      continue;
    }
    if (magic !== 0xfd2fb528) throw new Error("Ungültige Zstandard-Daten.");
    const descriptor = read(1);
    if (descriptor & 8) throw new Error("Ungültiger Zstandard-Header.");
    const singleSegment = Boolean(descriptor & 32);
    let windowSize = 0;
    if (!singleSegment) {
      const window = read(1);
      const base = 2 ** (10 + (window >>> 3));
      windowSize = base + (base / 8) * (window & 7);
    }
    const dictionaryFlag = descriptor & 3;
    skip(dictionaryFlag === 3 ? 4 : dictionaryFlag);
    const sizeFlag = descriptor >>> 6;
    const sizeBytes = sizeFlag ? 2 ** sizeFlag : singleSegment ? 1 : 0;
    const frameSize = read(sizeBytes) + (sizeFlag === 1 ? 256 : 0);
    declaredTotal += frameSize;
    if (
      (singleSegment ? frameSize : windowSize) > maximum ||
      declaredTotal > maximum
    )
      throw limitError();
    let last = false;
    while (!last) {
      const block = read(3);
      last = Boolean(block & 1);
      const kind = (block >>> 1) & 3;
      const size = block >>> 3;
      if (kind === 3 || size > 128 * 1024)
        throw new Error("Ungültiger Zstandard-Block.");
      skip(kind === 1 ? 1 : size);
    }
    if (descriptor & 4) skip(4);
  }
}

export function decompressBoundedZstd(
  bytes: Uint8Array,
  maximum: number,
): Uint8Array {
  checkZstdWindows(bytes, maximum);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const decoder = new Decompress((chunk) => {
    size += chunk.length;
    if (size > maximum) throw limitError();
    chunks.push(chunk.slice());
  });
  decoder.push(bytes, true);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
