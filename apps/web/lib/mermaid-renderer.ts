import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const allowedInlineStyleProperties = new Set([
  "background-color",
  "color",
  "color-interpolation-filters",
  "dominant-baseline",
  "fill",
  "fill-opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "max-width",
  "opacity",
  "overflow",
  "stop-color",
  "stop-opacity",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "stroke-width",
  "text-anchor",
  "vector-effect",
]);

let renderQueue: Promise<void> = Promise.resolve();

export const mermaidThemeVariables = (dark: boolean) =>
  dark
    ? {
        darkMode: true,
        background: "#10182b",
        primaryColor: "#1e3156",
        primaryTextColor: "#f5f7ff",
        primaryBorderColor: "#9eb9f4",
        secondaryColor: "#243a31",
        secondaryTextColor: "#f5fff9",
        secondaryBorderColor: "#88c7a6",
        tertiaryColor: "#3b2f1e",
        tertiaryTextColor: "#fff8e8",
        tertiaryBorderColor: "#d9b76e",
        lineColor: "#d7e1f7",
        textColor: "#f5f7ff",
        noteBkgColor: "#3b2f1e",
        noteTextColor: "#fff8e8",
        noteBorderColor: "#d9b76e",
        actorBkg: "#1e3156",
        actorBorder: "#9eb9f4",
        actorTextColor: "#f5f7ff",
        actorLineColor: "#9eb9f4",
        signalColor: "#f5f7ff",
        signalTextColor: "#f5f7ff",
        labelBoxBkgColor: "#1e3156",
        labelBoxBorderColor: "#9eb9f4",
        labelTextColor: "#f5f7ff",
        loopTextColor: "#f5f7ff",
        activationBkgColor: "#243a31",
        activationBorderColor: "#88c7a6",
        sequenceNumberColor: "#f5f7ff",
        rectBkgColor: "#17233d",
        sectionBkgColor: "#17233d",
        sectionBkgColor2: "#1e3156",
        altSectionBkgColor: "#17233d",
        excludeBkgColor: "#2b2431",
      }
    : {
        darkMode: false,
        background: "#ffffff",
        primaryColor: "#e8efff",
        primaryTextColor: "#101a35",
        primaryBorderColor: "#3357a4",
        secondaryColor: "#e8f4ee",
        secondaryTextColor: "#14291f",
        secondaryBorderColor: "#377759",
        tertiaryColor: "#fff3d6",
        tertiaryTextColor: "#35280f",
        tertiaryBorderColor: "#8a6415",
        lineColor: "#31415f",
        textColor: "#101a35",
        noteBkgColor: "#fff3d6",
        noteTextColor: "#35280f",
        noteBorderColor: "#8a6415",
        actorBkg: "#e8efff",
        actorBorder: "#3357a4",
        actorTextColor: "#101a35",
        actorLineColor: "#3357a4",
        signalColor: "#101a35",
        signalTextColor: "#101a35",
        labelBoxBkgColor: "#e8efff",
        labelBoxBorderColor: "#3357a4",
        labelTextColor: "#101a35",
        loopTextColor: "#101a35",
        activationBkgColor: "#e8f4ee",
        activationBorderColor: "#377759",
        sequenceNumberColor: "#101a35",
        rectBkgColor: "#fff3d6",
        sectionBkgColor: "#fff3d6",
        sectionBkgColor2: "#e8efff",
        altSectionBkgColor: "#f5f7ff",
        excludeBkgColor: "#f3edf3",
      };

export function sanitizeMermaidSvg(svg: string): string | null {
  const sanitized = sanitizeSvgBytes(encoder.encode(svg));
  return sanitized ? decoder.decode(sanitized) : null;
}

function setSvgStyle(
  root: Element,
  selector: string,
  property: "fill" | "stroke",
  value: string,
): void {
  root.querySelectorAll<SVGElement>(selector).forEach((element) => {
    element.setAttribute(property, value);
    element.style.removeProperty(property);
  });
}

export function applyMermaidSequenceContrast(
  root: Element,
  dark: boolean,
): void {
  const colors = dark
    ? {
        actorBackground: "#1e3156",
        actorBorder: "#9eb9f4",
        actorText: "#f5f7ff",
        activationBackground: "#243a31",
        activationBorder: "#88c7a6",
        sectionBackground: "#17233d",
      }
    : {
        actorBackground: "#e8efff",
        actorBorder: "#3357a4",
        actorText: "#101a35",
        activationBackground: "#e8f4ee",
        activationBorder: "#377759",
        sectionBackground: "#fff3d6",
      };

  setSvgStyle(root, "rect.actor", "fill", colors.actorBackground);
  setSvgStyle(root, "rect.actor", "stroke", colors.actorBorder);
  setSvgStyle(root, "text.actor, text.actor tspan", "fill", colors.actorText);
  setSvgStyle(root, "text.actor", "stroke", "none");
  setSvgStyle(root, ".actor-line", "stroke", colors.actorBorder);
  setSvgStyle(root, ".labelBox", "fill", colors.actorBackground);
  setSvgStyle(root, ".labelBox", "stroke", colors.actorBorder);
  setSvgStyle(
    root,
    ".labelText, .labelText tspan, .loopText, .loopText tspan, .sectionTitle, .sectionTitle tspan, .messageText, .messageText tspan",
    "fill",
    colors.actorText,
  );
  setSvgStyle(root, ".loopLine", "stroke", colors.actorBorder);
  setSvgStyle(root, ".messageLine0, .messageLine1", "stroke", colors.actorText);
  setSvgStyle(
    root,
    "rect.activation0, rect.activation1, rect.activation2",
    "fill",
    colors.activationBackground,
  );
  setSvgStyle(
    root,
    "rect.activation0, rect.activation1, rect.activation2",
    "stroke",
    colors.activationBorder,
  );
  setSvgStyle(
    root,
    "rect.rect, rect.loopLine",
    "fill",
    colors.sectionBackground,
  );
}

function inlineMermaidStyles(svg: string, dark: boolean): string | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return null;
  const root = parsed.documentElement;
  const styleText = [...parsed.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .join("\n");
  if (
    /@import|expression\s*\(|(?:https?:|data:|javascript:|file:)/i.test(
      styleText,
    )
  ) {
    return null;
  }

  const style = document.createElement("style");
  style.media = "not all";
  style.textContent = styleText;
  document.head.append(style);
  const rules = [...(style.sheet?.cssRules ?? [])];
  style.remove();
  for (const rule of rules) {
    if (rule.type !== CSSRule.STYLE_RULE) continue;
    const styleRule = rule as CSSStyleRule;
    let matches: Element[];
    try {
      matches = [
        ...(root.matches(styleRule.selectorText) ? [root] : []),
        ...root.querySelectorAll(styleRule.selectorText),
      ];
    } catch {
      return null;
    }
    for (const element of matches) {
      for (const property of styleRule.style) {
        if (!allowedInlineStyleProperties.has(property)) continue;
        (element as SVGElement).style.setProperty(
          property,
          styleRule.style.getPropertyValue(property),
        );
      }
    }
  }
  applyMermaidSequenceContrast(root, dark);
  parsed.querySelectorAll("style").forEach((element) => element.remove());
  return new XMLSerializer().serializeToString(root);
}

async function renderNow(
  source: string,
  id: string,
  dark: boolean,
): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    theme: "base",
    themeVariables: mermaidThemeVariables(dark),
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    deterministicIds: true,
    deterministicIDSeed: id,
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  await mermaid.parse(source, { suppressErrors: false });
  const result = await mermaid.render(id, source);
  const styled = inlineMermaidStyles(result.svg, dark);
  const sanitized = styled ? sanitizeMermaidSvg(styled) : null;
  if (!sanitized) {
    throw new Error("Mermaid produced unsupported or unsafe SVG output");
  }
  return sanitized;
}

export function renderMermaidDiagram(
  source: string,
  id: string,
  dark: boolean,
): Promise<string> {
  const task = renderQueue.then(() => renderNow(source, id, dark));
  renderQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
