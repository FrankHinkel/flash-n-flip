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

export type MermaidDiagramPresentation = {
  widthPercent?: number;
  heightPx?: number;
  background?: string;
};

const backgroundPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseMermaidDiagramPresentation(
  value: unknown,
): MermaidDiagramPresentation | null {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value !== "string" || value.length > 200) return null;
  const match = value.trim().match(/^\{([^{}]*)\}$/);
  if (!match) return null;
  const presentation: MermaidDiagramPresentation = {};
  const seen = new Set<string>();
  for (const token of match[1]!.trim().split(/\s+/).filter(Boolean)) {
    const pair = token.match(/^([a-z]+)=(\S+)$/i);
    if (!pair) return null;
    const [, rawKey, rawValue] = pair;
    const key = rawKey!.toLowerCase();
    const option = rawValue!;
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "w") {
      const width = option.match(/^(100|[1-9][0-9]?)%$/);
      if (!width) return null;
      presentation.widthPercent = Number(width[1]);
    } else if (key === "h") {
      const height = option.match(/^([1-9][0-9]{2,3})px$/i);
      const pixels = height ? Number(height[1]) : 0;
      if (!height || pixels < 120 || pixels > 1200) return null;
      presentation.heightPx = pixels;
    } else if (key === "bg") {
      if (!backgroundPattern.test(option)) return null;
      presentation.background = option.toLowerCase();
    } else {
      return null;
    }
  }
  return presentation;
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
