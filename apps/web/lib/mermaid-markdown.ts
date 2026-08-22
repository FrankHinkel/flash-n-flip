import {
  mermaidDiagramBlockSchema,
  mermaidDiagramExamples,
  mermaidDiagramTypeFromSource,
  type MermaidDiagramBlock,
  type MermaidDiagramType,
} from "@flashcards/domain/mermaid-diagram";

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

export function extractSafeMermaidFences(
  markdown: string,
  locale: "en" | "de",
): { markdown: string; diagrams: MermaidDiagramBlock[] } {
  const diagrams: MermaidDiagramBlock[] = [];
  const withoutDiagrams = markdown.replace(
    /(^|\n)[ \t]*```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```(?=\n|$)/gi,
    (fence, prefix: string, source: string) => {
      const diagramType = mermaidDiagramTypeFromSource(source);
      if (!diagramType) return fence;
      const candidate = createMermaidDiagramBlock(
        diagramType,
        locale,
        source.trim(),
      );
      const parsed = mermaidDiagramBlockSchema.safeParse(candidate);
      if (!parsed.success) return fence;
      diagrams.push(parsed.data);
      return prefix;
    },
  );
  if (!diagrams.length) return { markdown, diagrams };
  return {
    markdown: withoutDiagrams.replace(/\n{3,}/g, "\n\n").trim(),
    diagrams,
  };
}
