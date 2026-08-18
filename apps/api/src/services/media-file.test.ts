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
    expect(detectSupportedMedia(mp4, "pronunciation.mp3")).toBeNull();
  });

  it("does not trust an audio-looking name when the bytes contain an image", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectSupportedMedia(png, "voice.m4a")?.kind).toBe("image");
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

  it("sanitizes KanjiVG metadata, declarations and presentation styles", () => {
    const sanitized = sanitizeImportedSvg(
      Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd" [
          <!ATTLIST path xmlns:kvg CDATA #FIXED "http://kanjivg.tagaini.net" kvg:type CDATA #IMPLIED>
        ]>
        <svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
          <g id="kvg:StrokePaths_065e5" style="fill:none;stroke:#000000;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;">
            <path id="kvg:065e5-s1" kvg:type="㇑" d="M31.5,24.5c1.12,1.12,1.74,2.75,1.74,4.75"/>
          </g>
          <g style="font-size:8;fill:#808080"><text transform="matrix(1 0 0 1 25.25 32.63)">1</text></g>
        </svg>`),
    )?.toString("utf8");

    expect(sanitized).toContain(
      '<g id="kvg:StrokePaths_065e5" fill="none" stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">',
    );
    expect(sanitized).toContain('<g font-size="8" fill="#808080">');
    expect(sanitized).not.toMatch(/DOCTYPE|xmlns:kvg|kvg:type|style=/);
  });

  it("keeps fragment-only references and removes external CSS containers", () => {
    expect(
      sanitizeImportedSvg(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><use href="#private"/></svg>',
        ),
      )?.toString("utf8"),
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="#private"/></svg>',
    );
    expect(
      sanitizeImportedSvg(
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://example.com/x.css)</style></svg>',
        ),
      )?.toString("utf8"),
    ).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://example.com"/></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/tracker.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://example.com/tracker.svg)" d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="behavior:url(#payload)" d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path xlink:href="https://example.com/payload.svg" d="M0 0"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="x"/></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>',
  ])("rejects active or externally referencing SVG: %s", (svg) => {
    expect(sanitizeImportedSvg(Buffer.from(svg))).toBeNull();
  });
});
