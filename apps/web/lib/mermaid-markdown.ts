import {
  mermaidDiagramBlockSchema,
  mermaidDiagramExamples,
  mermaidDiagramTypeFromSource,
  type MermaidDiagramBlock,
  type MermaidDiagramType,
} from "@flashcards/domain/mermaid-diagram";
import {
  translateUiMessage,
  type Locale,
  type UiMessageKey,
} from "@flashcards/i18n";

import {
  defaultMediaPresentation,
  parseMediaPresentationDetailed,
  type MediaPresentation,
} from "./media-presentation";

export const mermaidDiagramNameKeys: Readonly<
  Record<MermaidDiagramType, UiMessageKey>
> = {
  flowchart: "rich.mermaid.name.flowchart",
  sequence: "rich.mermaid.name.sequence",
  state: "rich.mermaid.name.state",
  class: "rich.mermaid.name.class",
  er: "rich.mermaid.name.er",
  mindmap: "rich.mermaid.name.mindmap",
  timeline: "rich.mermaid.name.timeline",
};

export type MermaidDiagramPresentation = MediaPresentation;

export const defaultMermaidDiagramPresentation: MermaidDiagramPresentation = {
  ...defaultMediaPresentation,
  width: { ...defaultMediaPresentation.width },
  height: { ...defaultMediaPresentation.height },
};

export function parseMermaidDiagramPresentation(
  value: unknown,
): MermaidDiagramPresentation | null {
  const parsed = parseMediaPresentationDetailed(value);
  return parsed.success ? parsed.presentation : null;
}

export function createMermaidDiagramBlock(
  diagramType: MermaidDiagramType,
  locale: Locale,
  source = mermaidDiagramExamples[diagramType],
): MermaidDiagramBlock {
  return {
    type: "mermaidDiagram",
    version: 1,
    diagramType,
    source,
    label: translateUiMessage(locale, mermaidDiagramNameKeys[diagramType]),
    description: translateUiMessage(locale, "rich.mermaid.description"),
  };
}

export function mermaidDiagramFromMarkdownSource(
  source: string,
  locale: Locale,
): MermaidDiagramBlock | null {
  const diagramType = mermaidDiagramTypeFromSource(source);
  if (!diagramType) return null;
  const parsed = mermaidDiagramBlockSchema.safeParse(
    createMermaidDiagramBlock(diagramType, locale, source.trim()),
  );
  return parsed.success ? parsed.data : null;
}
