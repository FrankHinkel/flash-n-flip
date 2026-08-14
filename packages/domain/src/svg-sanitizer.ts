const allowedSvgElements = new Set([
  "svg",
  "g",
  "title",
  "desc",
  "defs",
  "use",
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
  "title",
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
  "href",
  "overflow",
  "xml:space",
  "fx",
  "fy",
  "fr",
]);

const svgReferenceAttributes = new Set(["clip-path", "fill", "mask", "stroke"]);
const allowedSvgStyleProperties = new Set([
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
  "clip-rule",
  "opacity",
  "vector-effect",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "stop-color",
  "stop-opacity",
  "overflow",
]);
const svgUtf8 = new TextDecoder("utf-8", { fatal: true });
const svgEncoder = new TextEncoder();
const svgMetadataPattern =
  /<metadata(?:\s[^>]*)?\/>|<metadata(?:\s[^>]*)?>[\s\S]*?<\/metadata\s*>/g;
const discardedSvgContainerPattern =
  /<(style|description|sodipodi:namedview)(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/g;
const discardedSvgEditorElementPattern =
  /<(?:inkscape:perspective|amcharts:ammap|sodipodi:namedview)(?:\s[^>]*)?\/\s*>/g;
const forbiddenDiscardedSvgContent =
  /<\s*(?:script|style|iframe|object|embed|form|link|foreignObject|animate|set)\b|\bon[a-z][a-z0-9_-]*\s*=|(?:javascript|data:text\/html|file):/i;
const forbiddenActiveSvgContent =
  /<\s*(?:script|iframe|object|embed|form|link|foreignObject|animate|set)\b|\bon[a-z][a-z0-9_-]*\s*=|(?:javascript|data:text\/html|file):/i;
const ignoredSvgNamespacePrefixes = [
  "amcharts",
  "cc",
  "dc",
  "inkscape",
  "rdf",
  "sketch",
  "sodipodi",
  "svg",
];

const escapeSvgAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const safeSvgAttributeValue = (name: string, value: string): boolean => {
  if (name === "xmlns") return value === "http://www.w3.org/2000/svg";
  if (name === "href") return /^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value);
  if (name === "overflow")
    return /^(?:visible|hidden|scroll|auto)$/.test(value);
  if (name === "xml:space") return /^(?:default|preserve)$/.test(value);
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

const sanitizedSvgStyleAttributes = (
  value: string,
): Array<[string, string]> | null => {
  const sanitized: Array<[string, string]> = [];
  const names = new Set<string>();
  for (const rawDeclaration of value.split(";")) {
    const declaration = rawDeclaration.trim();
    if (!declaration) continue;
    const separator = declaration.indexOf(":");
    if (separator <= 0) return null;
    const name = declaration.slice(0, separator).trim().toLowerCase();
    const declarationValue = declaration.slice(separator + 1).trim();
    if (
      !allowedSvgStyleProperties.has(name) ||
      !declarationValue ||
      names.has(name) ||
      !safeSvgAttributeValue(name, declarationValue)
    ) {
      return null;
    }
    names.add(name);
    sanitized.push([name, declarationValue]);
  }
  return sanitized;
};

/**
 * Accepts only inert SVG drawing primitives and serializes them into a
 * canonical document. Active content, CSS, animation, links, entities and
 * external references are rejected instead of being passed to a browser.
 */
export const sanitizeSvgBytes = (bytes: Uint8Array): Uint8Array | null => {
  let source: string;
  try {
    source = svgUtf8.decode(bytes);
  } catch {
    return null;
  }
  if (source.length === 0 || source.length > 2 * 1024 * 1024) return null;
  source = source.replace(/^\uFEFF/, "");
  if (/<!--(?![\s\S]*?-->)/.test(source)) return null;
  source = source.replace(/<!--[\s\S]*?-->/g, "");
  const rootIndex = source.search(/<\s*svg(?:\s|>)/);
  if (rootIndex < 0) return null;
  source = source.slice(rootIndex);
  if (forbiddenActiveSvgContent.test(source)) return null;
  let unsafeMetadata = false;
  source = source.replace(svgMetadataPattern, (metadata) => {
    if (forbiddenDiscardedSvgContent.test(metadata)) unsafeMetadata = true;
    return "";
  });
  if (unsafeMetadata) return null;
  source = source
    .replace(discardedSvgContainerPattern, "")
    .replace(discardedSvgEditorElementPattern, "");
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
    const serializedAttributeValues = new Map<string, string>();
    let attributeCursor = 0;
    while (attributeCursor < attributes.length) {
      const remaining = attributes.slice(attributeCursor);
      if (!remaining.trim()) break;
      const attribute = remaining.match(
        /^\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/,
      );
      if (!attribute) return null;
      const attributeName = attribute[1]!;
      const attributeValue = (attribute[2] ?? attribute[3] ?? "").replace(
        /[\t\n\r]+/g,
        " ",
      );
      const namespacePrefix = attributeName.split(":", 1)[0]!;
      if (
        attributeName === "xmlns:kvg" ||
        attributeName === "xmlns:xlink" ||
        attributeName.startsWith("kvg:") ||
        (attributeName.startsWith("xmlns:") &&
          ignoredSvgNamespacePrefixes.includes(attributeName.slice(6))) ||
        ignoredSvgNamespacePrefixes.includes(namespacePrefix)
      ) {
        attributeCursor += attribute[0].length;
        continue;
      }
      const canonicalAttributeName =
        attributeName === "xlink:href" ? "href" : attributeName;
      if (seenAttributes.has(canonicalAttributeName)) return null;
      seenAttributes.add(canonicalAttributeName);
      if (attributeName === "style") {
        const styleAttributes = sanitizedSvgStyleAttributes(attributeValue);
        if (!styleAttributes) return null;
        for (const [styleName, styleValue] of styleAttributes) {
          if (seenAttributes.has(styleName)) {
            if (serializedAttributeValues.get(styleName) !== styleValue)
              return null;
            continue;
          }
          seenAttributes.add(styleName);
          serializedAttributeValues.set(styleName, styleValue);
          serializedAttributes.push(
            `${styleName}="${escapeSvgAttribute(styleValue)}"`,
          );
        }
        attributeCursor += attribute[0].length;
        continue;
      }
      if (
        !allowedSvgAttributes.has(canonicalAttributeName) ||
        !safeSvgAttributeValue(canonicalAttributeName, attributeValue)
      ) {
        return null;
      }
      serializedAttributes.push(
        `${canonicalAttributeName}="${escapeSvgAttribute(attributeValue)}"`,
      );
      serializedAttributeValues.set(canonicalAttributeName, attributeValue);
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
  const sanitized = svgEncoder.encode(output.join("").trim());
  return sanitized.length > 0 ? sanitized : null;
};
