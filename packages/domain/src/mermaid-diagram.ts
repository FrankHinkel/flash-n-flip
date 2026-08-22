import { z } from "zod";

export const mermaidDiagramTypes = [
  "flowchart",
  "sequence",
  "state",
  "class",
  "er",
  "mindmap",
  "timeline",
] as const;

export type MermaidDiagramType = (typeof mermaidDiagramTypes)[number];

export const mermaidDiagramTypeSchema = z.enum(mermaidDiagramTypes);

export const mermaidDiagramExamples: Readonly<
  Record<MermaidDiagramType, string>
> = {
  flowchart: `flowchart LR
  glucose[Glucose] --> glycolysis[Glykolyse]
  glycolysis --> pyruvate[Pyruvat]`,
  sequence: `sequenceDiagram
  participant L as Lernende Person
  participant F as Flash-n-Flip
  L->>F: Antwort aufdecken
  F-->>L: Bewertung anbieten`,
  state: `stateDiagram-v2
  [*] --> Neu
  Neu --> Lernen
  Lernen --> Wiederholen
  Wiederholen --> Lernen`,
  class: `classDiagram
  class Deck {
    +title: string
  }
  class Card {
    +front: content
    +back: content
  }
  Deck "1" --> "many" Card`,
  er: `erDiagram
  DECK ||--o{ CARD : contains
  CARD ||--o{ REVIEW : records`,
  mindmap: `mindmap
  root((Biologie))
    Zelle
      Zellkern
      Membran
    Stoffwechsel
      Glykolyse`,
  timeline: `timeline
  title Entwicklung der Zelltheorie
  1665 : Hooke beschreibt Zellen
  1838 : Schleiden untersucht Pflanzen
  1839 : Schwann untersucht Tiere`,
};

const diagramHeaderPatterns: Readonly<Record<MermaidDiagramType, RegExp>> = {
  flowchart: /^(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)\b/i,
  sequence: /^sequenceDiagram\b/i,
  state: /^stateDiagram(?:-v2)?\b/i,
  class: /^classDiagram\b/i,
  er: /^erDiagram\b/i,
  mindmap: /^mindmap\b/i,
  timeline: /^timeline\b/i,
};

const unsafeSourcePatterns: ReadonlyArray<{
  pattern: RegExp;
  message: string;
}> = [
  {
    pattern: /^\s*---\s*$/m,
    message: "Mermaid frontmatter is not allowed",
  },
  {
    pattern: /%%\s*\{/i,
    message: "Mermaid init and configuration directives are not allowed",
  },
  {
    pattern: /^\s*click\b/im,
    message: "Mermaid links and callbacks are not allowed",
  },
  {
    pattern: /^\s*(?:classDef|style|linkStyle)\b/im,
    message: "Mermaid custom styles are not allowed",
  },
  {
    pattern: /^\s*(?:accTitle|accDescr)\s*:/im,
    message: "Accessibility text must use the structured block fields",
  },
  {
    pattern: /<\s*\/?\s*[a-z!]/i,
    message: "HTML is not allowed in Mermaid diagrams",
  },
  {
    pattern: /(?:https?:|data:|javascript:|file:|\\\\|\/\/)/i,
    message: "External resources and URL schemes are not allowed",
  },
  {
    pattern: /\b(?:image|icon)\s*:/i,
    message: "Images and icon packs are not allowed in Mermaid diagrams",
  },
  {
    pattern: /\b(?:href|xlink:href|on[a-z]+)\s*=/i,
    message: "Executable SVG or link attributes are not allowed",
  },
];

const edgePattern =
  /(?:<<?--+>>?|--+>|==+>|-.->|->>|-->>|<<--|<\|--|\*--|o--|--\||\|--)/g;
const participantPattern = /^\s*(?:participant|actor)\s+([^\s]+)/gim;
const identifierPattern = /\b[A-Za-z_][A-Za-z0-9_-]{0,79}\b/g;

export type MermaidSourceMetrics = {
  nodeCount: number;
  edgeCount: number;
  participantCount: number;
  lineCount: number;
};

export function mermaidDiagramTypeFromSource(
  source: string,
): MermaidDiagramType | null {
  const header = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%"));
  if (!header) return null;
  return (
    mermaidDiagramTypes.find((type) =>
      diagramHeaderPatterns[type].test(header),
    ) ?? null
  );
}

export function validateMermaidDiagramSource(
  source: string,
  declaredType: MermaidDiagramType,
): MermaidSourceMetrics {
  if (!source.trim() || source.length > 20_000) {
    throw new Error("Mermaid source must contain 1 to 20,000 characters");
  }
  if (/\r(?!\n)|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(source)) {
    throw new Error("Mermaid source contains unsupported control characters");
  }
  const lines = source.split(/\r?\n/);
  if (lines.length > 500 || lines.some((line) => line.length > 1_000)) {
    throw new Error("Mermaid source is too large or has an oversized line");
  }
  const actualType = mermaidDiagramTypeFromSource(source);
  if (actualType !== declaredType) {
    throw new Error("Declared Mermaid diagram type does not match its source");
  }
  for (const rule of unsafeSourcePatterns) {
    if (rule.pattern.test(source)) throw new Error(rule.message);
  }

  let nesting = 0;
  let maximumNesting = 0;
  for (const character of source) {
    // Curly braces are Mermaid syntax of their own (for example `o{` in ER
    // cardinalities), so only delimiters that actually form nested labels are
    // considered here.
    if ("([".includes(character)) {
      nesting += 1;
      maximumNesting = Math.max(maximumNesting, nesting);
    } else if (")]".includes(character)) {
      nesting -= 1;
      if (nesting < 0) throw new Error("Mermaid delimiters are unbalanced");
    }
  }
  if (nesting !== 0 || maximumNesting > 32) {
    throw new Error("Mermaid source is unbalanced or too deeply nested");
  }

  const edgeCount = source.match(edgePattern)?.length ?? 0;
  const participantCount = new Set(
    [...source.matchAll(participantPattern)].map((match) => match[1]),
  ).size;
  const ignoredIdentifiers = new Set([
    ...mermaidDiagramTypes,
    "flowchart",
    "graph",
    "sequenceDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "classDiagram",
    "erDiagram",
    "participant",
    "actor",
    "class",
    "state",
    "direction",
    "title",
    "root",
    "as",
  ]);
  const nodeCount = new Set(
    (source.match(identifierPattern) ?? []).filter(
      (identifier) => !ignoredIdentifiers.has(identifier),
    ),
  ).size;
  if (edgeCount > 300 || nodeCount > 150 || participantCount > 50) {
    throw new Error(
      "Mermaid diagram exceeds its object or relationship limits",
    );
  }
  return { nodeCount, edgeCount, participantCount, lineCount: lines.length };
}

export const mermaidDiagramBlockSchema = z
  .object({
    type: z.literal("mermaidDiagram"),
    version: z.literal(1),
    diagramType: mermaidDiagramTypeSchema,
    source: z.string().min(1).max(20_000),
    label: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1).max(5_000),
  })
  .strict()
  .superRefine((block, context) => {
    try {
      validateMermaidDiagramSource(block.source, block.diagramType);
    } catch (error) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message:
          error instanceof Error ? error.message : "Invalid Mermaid source",
      });
    }
  });

export type MermaidDiagramBlock = z.infer<typeof mermaidDiagramBlockSchema>;
