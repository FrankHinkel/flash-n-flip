import { describe, expect, it } from "vitest";

import { detectSupportedMedia } from "./media-file.js";

describe("detectSupportedMedia", () => {
  it("uses file signatures instead of trusting the extension", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectSupportedMedia(png, "tracking.mp3")).toEqual({
      mimeType: "image/png",
      extension: "png",
      kind: "image",
    });
  });

  it("does not mislabel an MP4 video container as audio", () => {
    const mp4 = Buffer.from([
      0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(detectSupportedMedia(mp4, "lecture.mp4")).toBeNull();
    expect(detectSupportedMedia(mp4, "pronunciation.m4a")).toEqual({
      mimeType: "audio/mp4",
      extension: "m4a",
      kind: "audio",
    });
  });
});
