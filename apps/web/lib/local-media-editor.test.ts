import { describe, expect, it } from "vitest";

import {
  LocalMediaValidationError,
  detectEditorMediaMimeType,
  imageCropSourceRect,
  maximumEditorImageBytes,
  normalizeImageCrop,
  resolveImageCrop,
  validateEditorMediaFile,
} from "./local-media-editor";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("local media editor validation", () => {
  it.each([
    [bytes(0xff, 0xd8, 0xff, 0xdb), "image/jpeg"],
    [bytes(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10), "image/png"],
    [new TextEncoder().encode("GIF89a"), "image/gif"],
    [new TextEncoder().encode("RIFF0000WEBP"), "image/webp"],
    [new TextEncoder().encode("RIFF0000WAVE"), "audio/wav"],
    [new TextEncoder().encode("OggS"), "audio/ogg"],
    [bytes(0x1a, 0x45, 0xdf, 0xa3), "audio/webm"],
    [bytes(0xff, 0xf1, 0x50, 0x80), "audio/aac"],
    [new TextEncoder().encode("ID3"), "audio/mpeg"],
  ])(
    "recognizes decoded signatures independently of extensions",
    (input, mime) => {
      expect(detectEditorMediaMimeType(input)).toBe(mime);
    },
  );

  it("rejects SVG and executable text even when the declared type says image", async () => {
    const file = Object.assign(
      new Blob(["<svg onload=alert(1)></svg>"], { type: "image/svg+xml" }),
      { name: "attack.svg" },
    );
    await expect(validateEditorMediaFile(file, "image")).rejects.toMatchObject({
      code: "UNSUPPORTED",
    });
  });

  it("rejects a declared MIME family that contradicts the signature", async () => {
    const file = Object.assign(
      new Blob([bytes(0xff, 0xd8, 0xff, 0xdb)], { type: "audio/mpeg" }),
      { name: "wrong.mp3" },
    );
    await expect(validateEditorMediaFile(file, "image")).rejects.toMatchObject({
      code: "MIME_MISMATCH",
    });
  });

  it("rejects a declared MIME subtype that contradicts the signature", async () => {
    const file = Object.assign(
      new Blob([bytes(0xff, 0xd8, 0xff, 0xdb)], { type: "image/png" }),
      { name: "wrong.png" },
    );
    await expect(validateEditorMediaFile(file, "image")).rejects.toMatchObject({
      code: "MIME_MISMATCH",
    });
  });

  it("rejects empty and oversized files before decoding", async () => {
    const empty = Object.assign(new Blob([], { type: "image/png" }), {
      name: "empty.png",
    });
    await expect(
      validateEditorMediaFile(empty, "image"),
    ).rejects.toBeInstanceOf(LocalMediaValidationError);
    const oversized = Object.assign(
      new Blob([new Uint8Array(maximumEditorImageBytes + 1)], {
        type: "image/png",
      }),
      { name: "large.png" },
    );
    await expect(
      validateEditorMediaFile(oversized, "image"),
    ).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
  });

  it("normalizes unsafe file names and trusts the detected MIME", async () => {
    const file = Object.assign(
      new Blob([bytes(0xff, 0xd8, 0xff, 0xdb)], { type: "image/jpeg" }),
      { name: "../portrait.jpg" },
    );
    await expect(validateEditorMediaFile(file, "image")).resolves.toMatchObject(
      {
        fileName: "portrait.jpg",
        mimeType: "image/jpeg",
      },
    );
  });
});

describe("local image crop geometry", () => {
  it("keeps a normalized crop inside the image", () => {
    expect(
      normalizeImageCrop({ x: 0.9, y: -0.2, width: 0.4, height: 2 }),
    ).toEqual({ x: 0.6, y: 0, width: 0.4, height: 1 });
  });

  it("centers aspect-ratio presets in the oriented image", () => {
    expect(resolveImageCrop(400, 300, 0, "1:1")).toEqual({
      x: 0.125,
      y: 0,
      width: 0.75,
      height: 1,
    });
    expect(resolveImageCrop(400, 300, 90, "1:1")).toEqual({
      x: 0,
      y: 0.125,
      width: 1,
      height: 0.75,
    });
  });

  it("maps a rotated crop back to source pixels", () => {
    expect(imageCropSourceRect(400, 300, 90, "original")).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      outputWidth: 300,
      outputHeight: 400,
    });
  });
});
