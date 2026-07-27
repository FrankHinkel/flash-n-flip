import { describe, expect, it } from "vitest";

import { detectSupportedMedia, sanitizeImportedSvg } from "./media-file.js";

describe("detectSupportedMedia", () => {
  it("uses file signatures instead of trusting the extension", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectSupportedMedia(png, "tracking.mp3")).toEqual({
      mimeType: "image/png",
      extension: "png",
      kind: "image",
    });
  });

  it("distinguishes MP4 video from M4A audio by the validated filename", () => {
    const mp4 = Buffer.from([
      0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(detectSupportedMedia(mp4, "lecture.mp4")).toEqual({
      mimeType: "video/mp4",
      extension: "mp4",
      kind: "video",
    });
    expect(detectSupportedMedia(mp4, "pronunciation.m4a")).toEqual({
      mimeType: "audio/mp4",
      extension: "m4a",
      kind: "audio",
    });
  });
});

describe("sanitizeImportedSvg", () => {
  it("keeps inert vector shapes and removes comments", () => {
    const sanitized = sanitizeImportedSvg(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="650" height="444"><!-- generated --><g id="176c2dead1054e508e235b051dbeaf38-ao-1" fill="#ffeba2"><path d="M 1 2 L 3 4"/><rect x="4" y="5" width="6" height="7"/></g></svg>',
      ),
    );

    expect(sanitized?.toString("utf8")).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="650" height="444"><g id="176c2dead1054e508e235b051dbeaf38-ao-1" fill="#ffeba2"><path d="M 1 2 L 3 4"/><rect x="4" y="5" width="6" height="7"/></g></svg>',
    );
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://example.com"/></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/tracker.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="#private"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://example.com/x.css)</style></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="x"/></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>',
  ])("rejects active or externally referencing SVG: %s", (svg) => {
    expect(sanitizeImportedSvg(Buffer.from(svg))).toBeNull();
  });
});
