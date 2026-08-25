"use client";

import { Eraser, Info, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { JsxGraphBlock } from "@flashcards/domain/jsx-graph";

import type { JsxGraphPresentation } from "../lib/jsx-graph-markdown";
import {
  mediaPresentationBackground,
  mediaPresentationLengthCss,
  safeRichMediaErrorDetail,
} from "../lib/media-presentation";
import { defaultMermaidDiagramPresentation } from "../lib/mermaid-markdown";
import {
  renderJsxGraph,
  type RenderedJsxGraph,
} from "../lib/jsx-graph-renderer";
import { useMediaPresentationHeight } from "../lib/use-media-presentation";
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
  const figureRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedRef = useRef<RenderedJsxGraph | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [canClearTraces, setCanClearTraces] = useState(false);
  const requestedHeight = useMediaPresentationHeight(
    figureRef,
    presentation.height,
  );
  const requestedWidth = mediaPresentationLengthCss(presentation.width);
  const requestedBackground = mediaPresentationBackground(
    presentation.background,
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
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    setReady(false);
    setError("");
    setCanClearTraces(false);
    renderedRef.current?.destroy();
    renderedRef.current = null;
    container.replaceChildren();
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setError(text("rich.jsxGraph.timeout"));
    }, renderTimeoutMs);
    void renderJsxGraph(
      container,
      block,
      dark,
      () => active,
      presentation.sizePercent,
    )
      .then((rendered) => {
        if (!active) {
          rendered.destroy();
          return;
        }
        window.clearTimeout(timeout);
        renderedRef.current = rendered;
        setCanClearTraces(rendered.canClearTraces);
        setReady(true);
      })
      .catch((cause) => {
        if (!active) return;
        window.clearTimeout(timeout);
        if (process.env.NODE_ENV !== "production") {
          console.error("JSXGraph rendering failed", cause);
        }
        const detail = safeRichMediaErrorDetail(cause);
        const summary = text("rich.jsxGraph.failed");
        setError(detail ? `${summary} ${detail}` : summary);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      renderedRef.current?.destroy();
      renderedRef.current = null;
    };
  }, [
    block.description,
    block.label,
    block.source,
    dark,
    locale,
    presentation.sizePercent,
  ]);
  const reset = () => {
    renderedRef.current?.reset();
  };

  return (
    <figure
      aria-label={block.label}
      className="jsx-graph"
      data-jsx-graph="2d"
      onClick={(event) => event.stopPropagation()}
      ref={figureRef}
      style={{ width: requestedWidth }}
    >
      <div
        aria-describedby={descriptionId}
        aria-label={text("legacy.49a098455a10")}
        className="jsx-graph-viewport"
        data-custom-height={requestedHeight ? "true" : undefined}
        ref={containerRef}
        role="group"
        style={{
          background: requestedBackground,
          height: requestedHeight,
        }}
        tabIndex={0}
      />
      {!ready && !error ? (
        <p className="jsx-graph-status" role="status">
          {text("legacy.046b58bc84e4")}
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
          <span className="sr-only">{text("legacy.9a7634b46801")}</span>
        </summary>
        <p id={descriptionId}>{block.description}</p>
        <div className="jsx-graph-controls">
          <button
            aria-label={text("legacy.dcbe9bd4e371")}
            disabled={!ready}
            onClick={() => renderedRef.current?.board.zoomOut()}
            type="button"
          >
            <ZoomOut aria-hidden="true" size={20} />
          </button>
          <button
            aria-label={text("legacy.007f5349342e")}
            disabled={!ready}
            onClick={reset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={20} />
          </button>
          <button
            aria-label={text("legacy.d30ea4772a8e")}
            disabled={!ready}
            onClick={() => renderedRef.current?.board.zoomIn()}
            type="button"
          >
            <ZoomIn aria-hidden="true" size={20} />
          </button>
          {canClearTraces ? (
            <button
              aria-label={text("legacy.4baa79412142")}
              disabled={!ready}
              onClick={() => renderedRef.current?.clearTraces()}
              type="button"
            >
              <Eraser aria-hidden="true" size={20} />
            </button>
          ) : null}
        </div>
      </details>
    </figure>
  );
}
