"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { MermaidDiagramBlock } from "@flashcards/domain/mermaid-diagram";

import { clampMermaidScale, mermaidPinchScale } from "../lib/mermaid-gesture";
import {
  defaultMermaidDiagramPresentation,
  type MermaidDiagramPresentation,
} from "../lib/mermaid-markdown";
import { renderMermaidDiagram } from "../lib/mermaid-renderer";
import { useI18n } from "./i18n-provider";

const renderTimeoutMs = 12_000;
let renderSequence = 0;

const safeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "");

function backgroundPrefersDark(background: string | undefined): boolean | null {
  if (!background) return null;
  const value = background.slice(1);
  const expanded =
    value.length === 3 || value.length === 4
      ? [...value].map((part) => `${part}${part}`).join("")
      : value;
  const alpha =
    expanded.length === 8 ? Number.parseInt(expanded.slice(6), 16) : 255;
  // With a strongly translucent color, the app surface determines the actual
  // contrast more than the authored RGB value.
  if (alpha < 204) return null;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
}

export function MermaidDiagram({
  block,
  presentation = defaultMermaidDiagramPresentation,
}: {
  block: MermaidDiagramBlock;
  presentation?: MermaidDiagramPresentation;
}) {
  const { locale, text } = useI18n();
  const reactId = useId();
  const [markup, setMarkup] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dark, setDark] = useState(false);
  const drag = useRef<{
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const renderId = useMemo(
    () => `fnf-mermaid-${safeId(reactId)}-${block.diagramType}`,
    [block.diagramType, reactId],
  );
  const presentationDark = backgroundPrefersDark(presentation.background);
  const renderDark = presentationDark ?? dark;

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
    renderSequence += 1;
    const uniqueRenderId = `${renderId}-${renderSequence}`;
    void renderMermaidDiagram(block.source, uniqueRenderId, renderDark)
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
  }, [block.source, locale, renderDark, renderId]);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
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

  return (
    <figure
      className="mermaid-diagram"
      aria-label={block.label}
      data-mermaid-diagram={block.diagramType}
      onClick={(event) => event.stopPropagation()}
      style={{ width: requestedWidth }}
    >
      {markup ? (
        <>
          <div
            className="mermaid-diagram-viewport"
            data-custom-height={requestedHeight ? "true" : undefined}
            style={{
              background: presentation.background,
              height: requestedHeight,
            }}
            tabIndex={0}
            role="group"
            aria-label={text(
              "Diagram view; drag or use arrow keys to move, pinch or use plus and minus to zoom, zero to reset",
              "Diagrammansicht; zum Verschieben ziehen oder Pfeiltasten verwenden, zum Zoomen aufziehen oder Plus und Minus verwenden, mit Null zurücksetzen",
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
              if (delta) {
                event.preventDefault();
                setOffset((value) => ({
                  x: value.x + delta.x,
                  y: value.y + delta.y,
                }));
                return;
              }
              if (event.key === "+" || event.key === "=") {
                event.preventDefault();
                setScale((value) => clampMermaidScale(value + 0.2));
              } else if (event.key === "-") {
                event.preventDefault();
                setScale((value) => clampMermaidScale(value - 0.2));
              } else if (event.key === "0") {
                event.preventDefault();
                reset();
              }
            }}
            onWheel={(event) => {
              event.preventDefault();
              setScale((value) =>
                clampMermaidScale(value + (event.deltaY < 0 ? 0.12 : -0.12)),
              );
            }}
            onPointerDown={(event) => {
              if (event.pointerType === "mouse" && event.button !== 0) return;
              pointers.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              event.currentTarget.setPointerCapture(event.pointerId);
              if (pointers.current.size === 1) {
                drag.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                  left: offset.x,
                  top: offset.y,
                };
              } else if (pointers.current.size === 2) {
                const [first, second] = [...pointers.current.values()];
                pinch.current = {
                  distance: Math.hypot(
                    second!.x - first!.x,
                    second!.y - first!.y,
                  ),
                  scale,
                };
                drag.current = null;
              }
            }}
            onPointerMove={(event) => {
              if (!pointers.current.has(event.pointerId)) return;
              pointers.current.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY,
              });
              if (pointers.current.size === 2 && pinch.current) {
                const [first, second] = [...pointers.current.values()];
                const distance = Math.hypot(
                  second!.x - first!.x,
                  second!.y - first!.y,
                );
                setScale(
                  mermaidPinchScale(
                    pinch.current.scale,
                    pinch.current.distance,
                    distance,
                  ),
                );
              } else if (drag.current?.pointerId === event.pointerId) {
                setOffset({
                  x: drag.current.left + event.clientX - drag.current.x,
                  y: drag.current.top + event.clientY - drag.current.y,
                });
              }
            }}
            onPointerUp={(event) => {
              pointers.current.delete(event.pointerId);
              drag.current = null;
              pinch.current = null;
            }}
            onPointerCancel={(event) => {
              pointers.current.delete(event.pointerId);
              drag.current = null;
              pinch.current = null;
            }}
            onDoubleClick={reset}
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
