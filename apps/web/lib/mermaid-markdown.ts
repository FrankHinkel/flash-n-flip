import {
  mermaidDiagramBlockSchema,
  mermaidDiagramExamples,
  mermaidDiagramTypeFromSource,
  type MermaidDiagramBlock,
  type MermaidDiagramType,
} from "@flashcards/domain/mermaid-diagram";

import {
  defaultMediaPresentation,
  parseMediaPresentationDetailed,
  type MediaPresentation,
} from "./media-presentation";

export const mermaidDiagramNames: Readonly<
  Record<MermaidDiagramType, { en: string; de: string }>
> = {
  flowchart: { en: "Flowchart", de: "Flussdiagramm" },
  sequence: { en: "Sequence diagram", de: "Sequenzdiagramm" },
  state: { en: "State diagram", de: "Zustandsdiagramm" },
  class: { en: "Class diagram", de: "Klassendiagramm" },
  er: { en: "Entity relationship diagram", de: "ER-Diagramm" },
  mindmap: { en: "Mind map", de: "Mindmap" },
  timeline: { en: "Timeline", de: "Zeitleiste" },
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
  locale: "en" | "de",
  source = mermaidDiagramExamples[diagramType],
): MermaidDiagramBlock {
  return {
    type: "mermaidDiagram",
    version: 1,
    diagramType,
    source,
    label: mermaidDiagramNames[diagramType][locale],
    description:
      locale === "de"
        ? "Beschreibung des Diagramms und seiner wichtigsten Beziehungen."
        : "Description of the diagram and its most important relationships.",
  };
}

export function mermaidDiagramFromMarkdownSource(
  source: string,
  locale: "en" | "de",
): MermaidDiagramBlock | null {
  const diagramType = mermaidDiagramTypeFromSource(source);
  if (!diagramType) return null;
  const parsed = mermaidDiagramBlockSchema.safeParse(
    createMermaidDiagramBlock(diagramType, locale, source.trim()),
  );
  return parsed.success ? parsed.data : null;
}
