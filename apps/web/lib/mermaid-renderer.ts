import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let renderQueue: Promise<void> = Promise.resolve();

const themeVariables = (dark: boolean) =>
  dark
    ? {
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
      }
    : {
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
      };

export function sanitizeMermaidSvg(svg: string): string | null {
  const sanitized = sanitizeSvgBytes(encoder.encode(svg));
  return sanitized ? decoder.decode(sanitized) : null;
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
    themeVariables: themeVariables(dark),
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    deterministicIds: true,
    deterministicIDSeed: id,
    htmlLabels: false,
    flowchart: { htmlLabels: false, useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  await mermaid.parse(source, { suppressErrors: false });
  const result = await mermaid.render(id, source);
  const sanitized = sanitizeMermaidSvg(result.svg);
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
