import { describe, expect, it } from "vitest";

import { sanitizeSvgBytes } from "./svg-sanitizer";

const encode = (value: string) => new TextEncoder().encode(value);
const decode = (value: Uint8Array) => new TextDecoder().decode(value);

describe("shared SVG sanitizer", () => {
  it("canonicalizes inert vector markup", () => {
    const sanitized = sanitizeSvgBytes(
      encode('<svg width="10" height="10"><path d="M0 0 L1 1"/></svg>'),
    );
    expect(sanitized && decode(sanitized)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M0 0 L1 1"/></svg>',
    );
  });

  it.each([
    '<svg onload="alert(1)"></svg>',
    "<svg><script>alert(1)</script></svg>",
    '<svg><image href="https://example.com/tracker.png"/></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>',
  ])("rejects active SVG content: %s", (source) => {
    expect(sanitizeSvgBytes(encode(source))).toBeNull();
  });
});
