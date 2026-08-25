import {
  jsxGraphBlockSchema,
  parseJsxGraphSource,
  type JsxGraphBlock,
} from "@flashcards/domain/jsx-graph";
import { translateUiMessage, type Locale } from "@flashcards/i18n";

import {
  parseMermaidDiagramPresentation,
  type MermaidDiagramPresentation,
} from "./mermaid-markdown";

export type JsxGraphPresentation = MermaidDiagramPresentation;

export const parseJsxGraphPresentation = parseMermaidDiagramPresentation;

export function jsxGraphFromMarkdownSource(
  source: string,
  locale: Locale,
): JsxGraphBlock | null {
  try {
    const program = parseJsxGraphSource(source);
    const parsed = jsxGraphBlockSchema.safeParse({
      type: "jsxGraph",
      version: 1,
      source: source.trim(),
      label: program.title ?? translateUiMessage(locale, "rich.jsxGraph.label"),
      description: program.description,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
