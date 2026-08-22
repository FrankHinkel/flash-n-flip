"use client";

import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { MermaidDiagramBlock } from "@flashcards/domain/mermaid-diagram";

import { renderMermaidDiagram } from "../lib/mermaid-renderer";
import { useI18n } from "./i18n-provider";

const renderTimeoutMs = 12_000;

const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "");

export function MermaidDiagram({ block }: { block: MermaidDiagramBlock }) {
  const { locale, text } = useI18n();
  const reactId = useId();
  const [markup, setMarkup] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dark, setDark] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const descriptionId = `${safeId(reactId)}-description`;
  const labelId = `${safeId(reactId)}-label`;
  const renderId = useMemo(
    () => `fnf-mermaid-${safeId(reactId)}-${block.diagramType}`,
    [block.diagramType, reactId],
  );

  useEffect(() => {
    const root = document.documentElement;
    const update = () =>
      setDark(
        root.dataset.resolvedTheme === "dark" || root.dataset.theme === "dark",
      );
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-resolved-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setMarkup("");
    setError("");
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setError(
        locale === "de"
          ? "Das Diagramm brauchte zu lange zum Rendern."
          : "The diagram took too long to render.",
      );
    }, renderTimeoutMs);
    void renderMermaidDiagram(block.source, renderId, dark)
      .then((svg) => {
        if (!active) return;
        window.clearTimeout(timeout);
        setMarkup(svg);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setError(
          locale === "de"
            ? "Das Diagramm konnte nicht sicher gerendert werden."
            : "The diagram could not be rendered safely.",
        );
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [block.source, dark, locale, renderId]);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <figure
      className="mermaid-diagram"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      data-mermaid-diagram={block.diagramType}
    >
      <figcaption>
        <strong id={labelId}>{block.label}</strong>
        <span id={descriptionId}>{block.description}</span>
      </figcaption>
      {markup ? (
        <>
          <div
            className="mermaid-diagram-viewport"
            tabIndex={0}
            role="group"
            aria-label={text(
              "Diagram view; use arrow keys to move it",
              "Diagrammansicht; mit den Pfeiltasten verschieben",
            )}
            onKeyDown={(event) => {
              const distance = event.shiftKey ? 40 : 16;
              const delta =
                event.key === "ArrowLeft"
                  ? { x: distance, y: 0 }
                  : event.key === "ArrowRight"
                    ? { x: -distance, y: 0 }
                    : event.key === "ArrowUp"
                      ? { x: 0, y: distance }
                      : event.key === "ArrowDown"
                        ? { x: 0, y: -distance }
                        : null;
              if (!delta) return;
              event.preventDefault();
              setOffset((value) => ({
                x: value.x + delta.x,
                y: value.y + delta.y,
              }));
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              drag.current = {
                x: event.clientX,
                y: event.clientY,
                left: offset.x,
                top: offset.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drag.current) return;
              setOffset({
                x: drag.current.left + event.clientX - drag.current.x,
                y: drag.current.top + event.clientY - drag.current.y,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <div
              aria-hidden="true"
              className="mermaid-diagram-canvas"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: markup }}
            />
          </div>
          <div
            className="mermaid-diagram-controls"
            aria-label={text(
              "Diagram view controls",
              "Diagrammansicht steuern",
            )}
          >
            <button
              type="button"
              onClick={() => setScale((value) => Math.max(0.6, value - 0.2))}
              aria-label={text("Zoom diagram out", "Diagramm verkleinern")}
            >
              <ZoomOut aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label={text(
                "Reset diagram view",
                "Diagrammansicht zurücksetzen",
              )}
            >
              <RotateCcw aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              onClick={() => setScale((value) => Math.min(3, value + 0.2))}
              aria-label={text("Zoom diagram in", "Diagramm vergrößern")}
            >
              <ZoomIn aria-hidden="true" size={18} />
            </button>
          </div>
        </>
      ) : error ? (
        <div className="mermaid-diagram-error" role="alert">
          <p>{error}</p>
          <pre>
            <code>{block.source}</code>
          </pre>
        </div>
      ) : (
        <p className="mermaid-diagram-loading" role="status">
          {text(
            "Rendering diagram locally …",
            "Diagramm wird lokal gerendert …",
          )}
        </p>
      )}
    </figure>
  );
}
