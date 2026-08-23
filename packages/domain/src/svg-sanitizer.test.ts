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

  it("keeps the default size limit and caps explicitly larger local bounds", () => {
    const source = `<svg><path d="${"M0 0 ".repeat(20)}"/></svg>`;
    expect(sanitizeSvgBytes(encode(source), 40)).toBeNull();
    expect(sanitizeSvgBytes(encode(source), source.length)).not.toBeNull();
    expect(sanitizeSvgBytes(encode(source), 32 * 1024 * 1024 + 1)).toBeNull();
  });

  it("drops inert metadata and accepts XML whitespace in path data", () => {
    const sanitized = sanitizeSvgBytes(
      encode(`<?xml version="1.0"?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/SVG/DTD/svg10.dtd">
        <svg viewBox="0 0 10 10">
          <metadata>Created by a vector drawing tool</metadata>
          <g transform="translate(0,10)">
            <path d="M0 0
              L10 10" fill="#000000" stroke="none"/>
          </g>
        </svg>`),
    );

    const output = sanitized ? decode(sanitized) : "";
    expect(output).not.toContain("metadata");
    expect(output).toMatch(/<path d="M0 0\s+L10 10"/);
    expect(output).toContain('fill="#000000" stroke="none"');
  });

  it("drops editor-only markup and keeps safe internal references", () => {
    const sanitized = sanitizeSvgBytes(
      encode(`<svg xmlns="http://www.w3.org/2000/svg"
        xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
        xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
        xmlns:xlink="http://www.w3.org/1999/xlink"
        inkscape:version="1.2">
        <sodipodi:namedview pagecolor="#ffffff"/>
        <defs>
          <style>.country { fill: #000; }</style>
          <path id="country" d="M0 0 L10 10"/>
        </defs>
        <use xlink:href="#country" overflow="visible" style="overflow:visible;opacity:0.8"/>
      </svg>`),
    );

    const output = sanitized ? decode(sanitized) : "";
    expect(output).not.toContain("inkscape");
    expect(output).not.toContain("sodipodi");
    expect(output).not.toContain("<style");
    expect(output).toContain(
      '<use href="#country" overflow="visible" opacity="0.8"/>',
    );
  });

  it("keeps inert Mermaid markers and accessibility attributes", () => {
    const sanitized = sanitizeSvgBytes(
      encode(`<svg role="img" aria-roledescription="flowchart" viewBox="0 0 20 10">
        <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10"/></marker></defs>
        <path d="M0 5 L20 5" marker-end="url(#arrow)"/>
      </svg>`),
    );

    const output = sanitized ? decode(sanitized) : "";
    expect(output).toContain('role="img"');
    expect(output).toContain('aria-roledescription="flowchart"');
    expect(output).toContain('<marker id="arrow"');
    expect(output).toContain('marker-end="url(#arrow)"');
  });

  it("discards Mermaid's inert undefined style placeholder", () => {
    const sanitized = sanitizeSvgBytes(
      encode(
        '<svg><g style="stroke:#111;undefined;stroke:#123"><text name="node" data-from="A" data-to="B" data-type="edge">A</text></g></svg>',
      ),
    );
    const output = sanitized ? decode(sanitized) : "";

    expect(output).toContain(
      '<g stroke="#123"><text name="node" data-from="A" data-to="B" data-type="edge">A</text></g>',
    );
    expect(output).not.toContain("undefined");
  });

  it.each([
    '<svg onload="alert(1)"></svg>',
    "<svg><script>alert(1)</script></svg>",
    '<svg><image href="https://example.com/tracker.png"/></svg>',
    '<svg><use xlink:href="https://example.com/tracker.svg#shape"/></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><text>&xxe;</text></svg>',
    '<svg><metadata><script>alert(1)</script></metadata><path d="M0 0"/></svg>',
    '<svg><metadata onload="alert(1)">tool</metadata><path d="M0 0"/></svg>',
  ])("rejects active SVG content: %s", (source) => {
    expect(sanitizeSvgBytes(encode(source))).toBeNull();
  });
});
