import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function sanitizeMusicSvg(svg: string): string | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return null;
  parsed
    .querySelectorAll("style, title")
    .forEach((element) => element.remove());
  parsed.documentElement.removeAttribute("style");
  for (const element of parsed.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name.startsWith("data-") ||
        attribute.name === "selectable" ||
        attribute.name === "text-decoration"
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  const normalized = new XMLSerializer().serializeToString(
    parsed.documentElement,
  );
  const sanitized = sanitizeSvgBytes(encoder.encode(normalized));
  return sanitized ? decoder.decode(sanitized) : null;
}

export async function renderMusicScore(
  source: string,
  label: string,
): Promise<string[]> {
  const { default: abcjs } = await import("abcjs");
  const target = document.createElement("div");
  abcjs.renderAbc(target, source, {
    add_classes: false,
    ariaLabel: label,
    foregroundColor: "currentColor",
    responsive: "resize",
    stop_on_warning: true,
  });
  const rendered = [...target.querySelectorAll("svg")].map((svg) =>
    sanitizeMusicSvg(new XMLSerializer().serializeToString(svg)),
  );
  if (!rendered.length || rendered.some((svg) => !svg)) {
    throw new Error("abcjs produced unsupported or unsafe SVG output");
  }
  return rendered as string[];
}
