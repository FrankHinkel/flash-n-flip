"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  mermaidDiagramBlockSchema,
  mermaidDiagramTypes,
  type MermaidDiagramBlock,
  type MermaidDiagramType,
} from "@flashcards/domain/mermaid-diagram";

import { useI18n } from "./i18n-provider";
import { MermaidDiagram } from "./mermaid-diagram";
import {
  createMermaidDiagramBlock,
  mermaidDiagramNames,
} from "../lib/mermaid-markdown";

function DiagramPreview({ block }: { block: MermaidDiagramBlock }) {
  const { text } = useI18n();
  const [settled, setSettled] = useState(block);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSettled(block), 450);
    return () => window.clearTimeout(timeout);
  }, [block]);

  const result = mermaidDiagramBlockSchema.safeParse(settled);
  if (!result.success) {
    return (
      <p className="mermaid-editor-validation" role="status">
        {result.error.issues[0]?.message ??
          text("The diagram is not valid.", "Das Diagramm ist nicht gültig.")}
      </p>
    );
  }
  return <MermaidDiagram block={result.data} />;
}

export function MermaidDiagramEditor({
  blocks,
  onChange,
}: {
  blocks: readonly MermaidDiagramBlock[];
  onChange: (blocks: MermaidDiagramBlock[]) => void;
}) {
  const { locale, text } = useI18n();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const previousCount = useRef(blocks.length);

  useEffect(() => {
    if (blocks.length > previousCount.current && detailsRef.current) {
      detailsRef.current.open = true;
    }
    previousCount.current = blocks.length;
  }, [blocks.length]);
  const update = (index: number, next: MermaidDiagramBlock) =>
    onChange(
      blocks.map((block, blockIndex) => (blockIndex === index ? next : block)),
    );

  return (
    <details className="mermaid-editor" ref={detailsRef}>
      <summary>
        <ChevronDown aria-hidden="true" size={18} />
        {blocks.length
          ? text("Diagrams (Mermaid)", "Diagramme (Mermaid)")
          : text("Add diagram (Mermaid)", "Diagramm hinzufügen (Mermaid)")}
        {blocks.length ? <span>{blocks.length}</span> : null}
      </summary>
      <div className="mermaid-editor-body">
        <p>
          {text(
            "Diagrams are rendered locally. Links, callbacks, HTML, custom styles, images, and configuration directives are not allowed.",
            "Diagramme werden lokal gerendert. Links, Callbacks, HTML, eigene Styles, Bilder und Konfigurationsdirektiven sind nicht erlaubt.",
          )}
        </p>
        {blocks.map((block, index) => {
          const prefix = `${id}-${index}`;
          return (
            <section className="mermaid-editor-block" key={prefix}>
              <div className="mermaid-editor-heading">
                <strong>
                  {text("Diagram", "Diagramm")} {index + 1}
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      blocks.filter((_, blockIndex) => blockIndex !== index),
                    )
                  }
                  aria-label={text("Remove diagram", "Diagramm entfernen")}
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </div>
              <label htmlFor={`${prefix}-type`}>
                {text("Diagram type", "Diagrammart")}
              </label>
              <select
                id={`${prefix}-type`}
                value={block.diagramType}
                onChange={(event) => {
                  const diagramType = event.target.value as MermaidDiagramType;
                  update(index, {
                    ...block,
                    diagramType,
                    source: createMermaidDiagramBlock(diagramType, locale)
                      .source,
                  });
                }}
              >
                {mermaidDiagramTypes.map((type) => (
                  <option value={type} key={type}>
                    {mermaidDiagramNames[type][locale]}
                  </option>
                ))}
              </select>
              <label htmlFor={`${prefix}-label`}>
                {text("Visible title", "Sichtbarer Titel")}
              </label>
              <input
                id={`${prefix}-label`}
                maxLength={300}
                value={block.label}
                onChange={(event) =>
                  update(index, { ...block, label: event.target.value })
                }
              />
              <label htmlFor={`${prefix}-description`}>
                {text(
                  "Description for screen readers",
                  "Beschreibung für Screenreader",
                )}
              </label>
              <textarea
                id={`${prefix}-description`}
                className="mermaid-editor-description"
                maxLength={5_000}
                value={block.description}
                onChange={(event) =>
                  update(index, { ...block, description: event.target.value })
                }
              />
              <div className="mermaid-editor-source-heading">
                <label htmlFor={`${prefix}-source`}>
                  {text("Mermaid source", "Mermaid-Quelltext")}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    update(index, {
                      ...block,
                      source: createMermaidDiagramBlock(
                        block.diagramType,
                        locale,
                      ).source,
                    })
                  }
                >
                  {text("Insert example", "Beispiel einsetzen")}
                </button>
              </div>
              <textarea
                id={`${prefix}-source`}
                className="mermaid-editor-source"
                maxLength={20_000}
                spellCheck={false}
                value={block.source}
                onChange={(event) =>
                  update(index, { ...block, source: event.target.value })
                }
              />
              <div className="mermaid-editor-preview">
                <span>{text("Preview", "Vorschau")}</span>
                <DiagramPreview block={block} />
              </div>
            </section>
          );
        })}
        <button
          type="button"
          className="mermaid-editor-add"
          onClick={() =>
            onChange([
              ...blocks,
              createMermaidDiagramBlock("flowchart", locale),
            ])
          }
        >
          <Plus aria-hidden="true" size={18} />
          {text("Add diagram", "Diagramm hinzufügen")}
        </button>
        <a href="/app/help#mermaid-diagrams">
          {text("Mermaid syntax and examples", "Mermaid-Syntax und Beispiele")}
        </a>
      </div>
    </details>
  );
}
