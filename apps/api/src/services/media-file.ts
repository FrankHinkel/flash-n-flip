import { createHash } from "node:crypto";

export type SupportedMedia = {
  mimeType: string;
  extension: string;
  kind: "image" | "audio";
};

const ascii = (buffer: Buffer, start: number, end: number): string =>
  buffer.subarray(start, end).toString("ascii");

export const detectSupportedMedia = (
  buffer: Buffer,
  fileName?: string,
): SupportedMedia | null => {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: "image/jpeg", extension: "jpg", kind: "image" };
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: "image/png", extension: "png", kind: "image" };
  }
  if (
    buffer.length >= 12 &&
    ascii(buffer, 0, 4) === "RIFF" &&
    ascii(buffer, 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp", kind: "image" };
  }
  if (
    buffer.length >= 6 &&
    (ascii(buffer, 0, 6) === "GIF87a" || ascii(buffer, 0, 6) === "GIF89a")
  ) {
    return { mimeType: "image/gif", extension: "gif", kind: "image" };
  }
  if (
    buffer.length >= 12 &&
    ascii(buffer, 0, 4) === "RIFF" &&
    ascii(buffer, 8, 12) === "WAVE"
  ) {
    return { mimeType: "audio/wav", extension: "wav", kind: "audio" };
  }
  if (buffer.length >= 4 && ascii(buffer, 0, 4) === "OggS") {
    return { mimeType: "audio/ogg", extension: "ogg", kind: "audio" };
  }
  if (
    buffer.length >= 3 &&
    (ascii(buffer, 0, 3) === "ID3" ||
      (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0))
  ) {
    return { mimeType: "audio/mpeg", extension: "mp3", kind: "audio" };
  }
  if (buffer.length >= 12 && ascii(buffer, 4, 8) === "ftyp") {
    if (!fileName || !/\.(?:m4a|m4b|aac)$/i.test(fileName)) return null;
    return { mimeType: "audio/mp4", extension: "m4a", kind: "audio" };
  }
  return null;
};

export const mediaSha256 = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");
