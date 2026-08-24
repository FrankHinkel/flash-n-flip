import {
  jsxGraphBlockSchema,
  parseJsxGraphSource,
  type JsxGraphBlock,
} from "@flashcards/domain/jsx-graph";

import {
  parseMermaidDiagramPresentation,
  type MermaidDiagramPresentation,
} from "./mermaid-markdown";

export type JsxGraphPresentation = MermaidDiagramPresentation;

export const parseJsxGraphPresentation = parseMermaidDiagramPresentation;

export function jsxGraphFromMarkdownSource(
  source: string,
  locale: "en" | "de",
): JsxGraphBlock | null {
  try {
    const program = parseJsxGraphSource(source);
    const parsed = jsxGraphBlockSchema.safeParse({
      type: "jsxGraph",
      version: 1,
      source: source.trim(),
      label:
        program.title ??
        (locale === "de" ? "Interaktiver Graph" : "Interactive graph"),
      description: program.description,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
