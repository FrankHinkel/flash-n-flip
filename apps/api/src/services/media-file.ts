import { createHash } from "node:crypto";

export type SupportedMedia = {
  mimeType: string;
  extension: string;
  kind: "image" | "audio" | "video";
};

const allowedSvgElements = new Set([
  "svg",
  "g",
  "title",
  "desc",
  "defs",
  "clipPath",
  "mask",
  "linearGradient",
  "radialGradient",
  "stop",
  "rect",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
]);

const allowedSvgAttributes = new Set([
  "xmlns",
  "version",
  "id",
  "class",
  "width",
  "height",
  "viewBox",
  "preserveAspectRatio",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "clip-path",
  "clip-rule",
  "mask",
  "opacity",
  "transform",
  "vector-effect",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "fx",
  "fy",
  "fr",
]);

const svgReferenceAttributes = new Set(["clip-path", "fill", "mask", "stroke"]);
const svgUtf8 = new TextDecoder("utf-8", { fatal: true });

const escapeSvgAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const safeSvgAttributeValue = (name: string, value: string): boolean => {
  if (name === "xmlns") return value === "http://www.w3.org/2000/svg";
  if (
    /[\u0000-\u001f\u007f]/.test(value) ||
    /(?:https?:|data:|javascript:|file:|\/\/)/i.test(value) ||
    /[<&]/.test(value)
  ) {
    return false;
  }
  if (name === "id") return /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/.test(value);
  if (/\burl\s*\(/i.test(value)) {
    return (
      svgReferenceAttributes.has(name) &&
      /^url\(\s*#[A-Za-z_][A-Za-z0-9_.:-]*\s*\)$/i.test(value)
    );
  }
  return true;
};

/**
 * Accepts only inert SVG drawing primitives and serializes them into a
 * canonical document. Active content, CSS, animation, links, entities and
 * external references are rejected instead of being passed to a browser.
 */
export const sanitizeImportedSvg = (buffer: Buffer): Buffer | null => {
  let source: string;
  try {
    source = svgUtf8.decode(buffer);
  } catch {
    return null;
  }
  if (source.length === 0 || source.length > 2 * 1024 * 1024) return null;
  source = source.replace(/^\uFEFF/, "");
  if (/<!--(?![\s\S]*?-->)/.test(source)) return null;
  source = source.replace(/<!--[\s\S]*?-->/g, "");
  source = source.replace(/^\s*<\?xml\b[^?]*\?>/i, "");
  if (/<[!?]|<!\[CDATA\[|&/.test(source)) return null;

  const output: string[] = [];
  const stack: string[] = [];
  let cursor = 0;
  let rootSeen = false;
  while (cursor < source.length) {
    const opening = source.indexOf("<", cursor);
    const text = source.slice(cursor, opening < 0 ? source.length : opening);
    if (text) {
      if (!rootSeen && text.trim()) return null;
      output.push(text.replaceAll(">", "&gt;"));
    }
    if (opening < 0) break;
    const closing = source.indexOf(">", opening + 1);
    if (closing < 0) return null;
    const token = source.slice(opening, closing + 1);
    const closingMatch = token.match(/^<\s*\/\s*([A-Za-z][A-Za-z0-9]*)\s*>$/);
    if (closingMatch) {
      const name = closingMatch[1]!;
      if (stack.pop() !== name) return null;
      output.push(`</${name}>`);
      cursor = closing + 1;
      continue;
    }

    const selfClosing = /\/\s*>$/.test(token);
    const openingToken = selfClosing ? token.replace(/\/\s*>$/, ">") : token;
    const openingMatch = openingToken.match(
      /^<\s*([A-Za-z][A-Za-z0-9]*)([\s\S]*?)\s*>$/,
    );
    if (!openingMatch) return null;
    const name = openingMatch[1]!;
    if (!allowedSvgElements.has(name)) return null;
    if (!rootSeen) {
      if (name !== "svg") return null;
      rootSeen = true;
    } else if (stack.length === 0) {
      return null;
    }

    const attributes = openingMatch[2]!;
    const serializedAttributes: string[] = [];
    const seenAttributes = new Set<string>();
    let attributeCursor = 0;
    while (attributeCursor < attributes.length) {
      const remaining = attributes.slice(attributeCursor);
      if (!remaining.trim()) break;
      const attribute = remaining.match(
        /^\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/,
      );
      if (!attribute) return null;
      const attributeName = attribute[1]!;
      const attributeValue = attribute[2] ?? attribute[3] ?? "";
      if (
        !allowedSvgAttributes.has(attributeName) ||
        seenAttributes.has(attributeName) ||
        !safeSvgAttributeValue(attributeName, attributeValue)
      ) {
        return null;
      }
      seenAttributes.add(attributeName);
      serializedAttributes.push(
        `${attributeName}="${escapeSvgAttribute(attributeValue)}"`,
      );
      attributeCursor += attribute[0].length;
    }
    if (name === "svg" && !seenAttributes.has("xmlns")) {
      serializedAttributes.unshift('xmlns="http://www.w3.org/2000/svg"');
    }
    output.push(
      `<${name}${serializedAttributes.length ? ` ${serializedAttributes.join(" ")}` : ""}${selfClosing ? "/" : ""}>`,
    );
    if (!selfClosing) stack.push(name);
    cursor = closing + 1;
  }
  if (!rootSeen || stack.length > 0) return null;
  const sanitized = Buffer.from(output.join("").trim(), "utf8");
  return sanitized.length > 0 ? sanitized : null;
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
    if (fileName && /\.(?:m4a|m4b|aac)$/i.test(fileName)) {
      return { mimeType: "audio/mp4", extension: "m4a", kind: "audio" };
    }
    if (fileName && /\.mp4$/i.test(fileName)) {
      return { mimeType: "video/mp4", extension: "mp4", kind: "video" };
    }
    return null;
  }
  if (
    buffer.length >= 16 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
    buffer.subarray(0, Math.min(buffer.length, 256)).includes("webm")
  ) {
    return { mimeType: "video/webm", extension: "webm", kind: "video" };
  }
  return null;
};

export const mediaSha256 = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");
