"use client";

import { Info, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { JsxGraphBlock } from "@flashcards/domain/jsx-graph";

import type { JsxGraphPresentation } from "../lib/jsx-graph-markdown";
import { defaultMermaidDiagramPresentation } from "../lib/mermaid-markdown";
import {
  renderJsxGraph,
  type RenderedJsxGraph,
} from "../lib/jsx-graph-renderer";
import { useI18n } from "./i18n-provider";

const renderTimeoutMs = 12_000;

export function JsxGraph({
  block,
  presentation = defaultMermaidDiagramPresentation,
}: {
  block: JsxGraphBlock;
  presentation?: JsxGraphPresentation;
}) {
  const { locale, text } = useI18n();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedRef = useRef<RenderedJsxGraph | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);

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
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    setReady(false);
    setError("");
    renderedRef.current?.destroy();
    renderedRef.current = null;
    container.replaceChildren();
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setError(
        locale === "de"
          ? "Der interaktive Graph brauchte zu lange zum Rendern."
          : "The interactive graph took too long to render.",
      );
    }, renderTimeoutMs);
    void renderJsxGraph(container, block, dark)
      .then((rendered) => {
        if (!active) {
          rendered.destroy();
          return;
        }
        window.clearTimeout(timeout);
        renderedRef.current = rendered;
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setError(
          locale === "de"
            ? "Der interaktive Graph konnte nicht sicher gerendert werden."
            : "The interactive graph could not be rendered safely.",
        );
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      renderedRef.current?.destroy();
      renderedRef.current = null;
    };
  }, [block.description, block.label, block.source, dark, locale]);

  const requestedHeight = presentation.height
    ? `${presentation.height.value}${
        presentation.height.unit === "px" ? "px" : "dvh"
      }`
    : undefined;
  const requestedWidth =
    presentation.width.unit === "fill"
      ? "100%"
      : `${presentation.width.value}${
          presentation.width.unit === "percent" ? "%" : "vw"
        }`;
  const reset = () => {
    renderedRef.current?.reset();
  };

  return (
    <figure
      aria-label={block.label}
      className="jsx-graph"
      data-jsx-graph="2d"
      onClick={(event) => event.stopPropagation()}
      style={{ width: requestedWidth }}
    >
      <div
        aria-describedby={descriptionId}
        aria-label={text(
          "Interactive mathematical graph. Use Tab and arrow keys for movable objects; use two fingers to pan or zoom the board.",
          "Interaktiver mathematischer Graph. Mit Tab und Pfeiltasten bewegliche Objekte steuern; mit zwei Fingern die Zeichenfläche verschieben oder zoomen.",
        )}
        className="jsx-graph-viewport"
        data-custom-height={requestedHeight ? "true" : undefined}
        ref={containerRef}
        role="group"
        style={{
          background: presentation.background,
          height: requestedHeight,
        }}
        tabIndex={0}
      />
      {!ready && !error ? (
        <p className="jsx-graph-status" role="status">
          {text(
            "Rendering interactive graph …",
            "Interaktiver Graph wird aufgebaut …",
          )}
        </p>
      ) : null}
      {error ? (
        <div className="jsx-graph-error" role="alert">
          <strong>{error}</strong>
          <p>{block.description}</p>
          <pre>
            <code>{block.source}</code>
          </pre>
        </div>
      ) : null}
      <details className="jsx-graph-info">
        <summary>
          <Info aria-hidden="true" size={18} />
          <span className="sr-only">
            {text(
              "Graph information and controls",
              "Graphinformationen und Bedienung",
            )}
          </span>
        </summary>
        <p id={descriptionId}>{block.description}</p>
        <div className="jsx-graph-controls">
          <button
            aria-label={text("Zoom out", "Verkleinern")}
            disabled={!ready}
            onClick={() => renderedRef.current?.board.zoomOut()}
            type="button"
          >
            <ZoomOut aria-hidden="true" size={20} />
          </button>
          <button
            aria-label={text("Reset graph view", "Graphansicht zurücksetzen")}
            disabled={!ready}
            onClick={reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={20} />
          </button>
          <button
            aria-label={text("Zoom in", "Vergrößern")}
            disabled={!ready}
            onClick={() => renderedRef.current?.board.zoomIn()}
            type="button"
          >
            <ZoomIn aria-hidden="true" size={20} />
          </button>
        </div>
      </details>
    </figure>
  );
}
