"use client";

import katex from "katex";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import type {
  RichTextBlock,
  RichTextDocument,
} from "@flashcards/domain/content";

import { useI18n } from "./i18n-provider";
import { fitPopupToViewport, type PopupLayout } from "./popup-position";
import { completedClozeIds } from "./study-content";

type RichNode = RichTextDocument["content"][number];

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

const stableShuffle = (values: string[], seed: string): string[] =>
  [...values]
    .map((value, index) => ({
      value,
      key: hash(`${seed}:${index}:${value}`),
    }))
    .sort((left, right) => left.key - right.key)
    .map(({ value }) => value);

function MathContent({ latex, display }: { latex: string; display: boolean }) {
  const rendered = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        output: "htmlAndMathml",
        throwOnError: false,
        strict: "ignore",
        trust: false,
        maxExpand: 1000,
        maxSize: 20,
      });
    } catch {
      return "";
    }
  }, [display, latex]);
  const Element = display ? "div" : "span";
  if (!rendered) {
    return (
      <Element
        className={display ? "math-block" : "math-inline"}
        tabIndex={display ? 0 : undefined}
      >
        <code>{latex}</code>
      </Element>
    );
  }
  return (
    <Element
      className={display ? "math-block" : "math-inline"}
      tabIndex={display ? 0 : undefined}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

const collectClozes = (
  nodes: RichNode[],
): Array<{
  id: string;
  order: number;
}> => {
  const result: Array<{ id: string; order: number }> = [];
  const visit = (node: RichNode) => {
    if (node.type === "cloze") {
      result.push({
        id: String(node.attrs?.id ?? ""),
        order: Number(node.attrs?.order ?? 0),
      });
    }
    node.content?.forEach(visit);
  };
  nodes.forEach(visit);
  return result.sort((left, right) => left.order - right.order);
};

function ChoiceCloze({
  attrs,
  revealed,
  enabled,
  seed,
  onCorrect,
  onIncorrect,
}: {
  attrs: Record<string, unknown>;
  revealed: boolean;
  enabled: boolean;
  seed: string;
  onCorrect: () => void;
  onIncorrect: () => void;
}) {
  const { text } = useI18n();
  const containerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [popupLayout, setPopupLayout] = useState<PopupLayout | null>(null);
  const [error, setError] = useState("");
  const answer = String(attrs.answer ?? "");
  const choices = Array.isArray(attrs.choices)
    ? attrs.choices.map(String)
    : [answer];
  const shuffled = useMemo(
    () => stableShuffle(choices, `${seed}:${String(attrs.id)}`),
    [attrs.id, choices.join("\u0000"), seed],
  );

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !containerRef.current) return;
    const visualViewport = window.visualViewport;
    const updatePosition = () => {
      if (!menuRef.current || !containerRef.current) return;
      const anchor = containerRef.current.getBoundingClientRect();
      const menu = menuRef.current.getBoundingClientRect();
      setPopupLayout(
        fitPopupToViewport({
          anchor,
          popup: menu,
          viewport: {
            left: visualViewport?.offsetLeft ?? 0,
            top: visualViewport?.offsetTop ?? 0,
            width: visualViewport?.width ?? window.innerWidth,
            height: visualViewport?.height ?? window.innerHeight,
          },
        }),
      );
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(menuRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    visualViewport?.addEventListener("resize", updatePosition);
    visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      visualViewport?.removeEventListener("resize", updatePosition);
      visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [error, open, shuffled.length]);

  const popupStyle: CSSProperties | undefined = popupLayout
    ? {
        left: popupLayout.left,
        top: popupLayout.top,
        width: popupLayout.width,
        maxHeight: popupLayout.maxHeight,
        visibility: "visible",
      }
    : undefined;

  if (revealed) return <span className="cloze-answer">{answer}</span>;

  return (
    <span
      className="choice-cloze"
      ref={containerRef}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="cloze-blank"
        disabled={!enabled}
        aria-expanded={open}
        onClick={() => {
          setError("");
          if (choices.length === 1) onCorrect();
          else {
            setPopupLayout(null);
            setOpen((current) => !current);
          }
        }}
      >
        {attrs.hint ? String(attrs.hint) : "…"}
      </button>
      {open && (
        <span
          className={`cloze-choice-menu ${popupLayout?.placement ?? "below"}`}
          role="group"
          ref={menuRef}
          style={popupStyle}
        >
          <span className="sr-only">
            {text("Choose the missing answer", "Wähle die fehlende Antwort")}
          </span>
          {shuffled.map((choice) => (
            <button
              type="button"
              key={choice}
              onClick={() => {
                if (choice === answer) {
                  setOpen(false);
                  onCorrect();
                } else {
                  onIncorrect();
                  setError(
                    text(
                      "Not quite. Try again.",
                      "Noch nicht richtig. Versuche es erneut.",
                    ),
                  );
                }
              }}
            >
              {choice}
            </button>
          ))}
          {error && (
            <span className="cloze-feedback" role="status">
              {error}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

const withMarks = (value: ReactNode, marks: RichNode["marks"], key: string) =>
  (marks ?? []).reduce<ReactNode>((current, mark, index) => {
    if (mark.type === "bold")
      return <strong key={`${key}-bold-${index}`}>{current}</strong>;
    if (mark.type === "italic")
      return <em key={`${key}-italic-${index}`}>{current}</em>;
    if (mark.type === "strike")
      return <s key={`${key}-strike-${index}`}>{current}</s>;
    if (mark.type === "code")
      return <code key={`${key}-code-${index}`}>{current}</code>;
    if (mark.type === "underline")
      return <u key={`${key}-underline-${index}`}>{current}</u>;
    if ("attrs" in mark) {
      return (
        <a
          href={mark.attrs.href}
          key={`${key}-link-${index}`}
          rel="noopener noreferrer nofollow"
          target={mark.attrs.target ?? "_blank"}
          title={mark.attrs.title ?? undefined}
        >
          {current}
        </a>
      );
    }
    return current;
  }, value);

export function RichTextContent({
  block,
  answer = false,
  shuffleSeed = "preview",
  onClozeCorrect,
  onClozeIncorrect,
}: {
  block: RichTextBlock;
  answer?: boolean;
  shuffleSeed?: string;
  onClozeCorrect?: (clozeId: string) => void;
  onClozeIncorrect?: () => void;
}) {
  const { text } = useI18n();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const clozes = useMemo(
    () => collectClozes(block.document.content),
    [block.document],
  );
  const currentId = clozes.find(({ id }) => !revealedIds.has(id))?.id;

  const reveal = (id: string) => {
    setRevealedIds((current) =>
      block.revealMode === "ALL"
        ? new Set(clozes.map((cloze) => cloze.id))
        : new Set(current).add(id),
    );
  };

  const renderNodes = (nodes: RichNode[], path: string): ReactNode =>
    nodes.map((node, index) => {
      const key = `${path}-${index}`;
      if (node.type === "text") {
        return withMarks(node.text ?? "", node.marks, key);
      }
      if (node.type === "cloze") {
        const id = String(node.attrs?.id ?? key);
        return (
          <ChoiceCloze
            key={key}
            attrs={node.attrs ?? {}}
            revealed={answer || revealedIds.has(id)}
            enabled={block.revealMode === "ALL" || currentId === id || answer}
            seed={shuffleSeed}
            onCorrect={() => {
              reveal(id);
              completedClozeIds(
                block.revealMode,
                clozes.map((cloze) => cloze.id),
                id,
              ).forEach((clozeId) => onClozeCorrect?.(clozeId));
            }}
            onIncorrect={() => onClozeIncorrect?.()}
          />
        );
      }
      if (node.type === "mathInline" || node.type === "mathBlock") {
        return (
          <MathContent
            key={key}
            latex={String(node.attrs?.latex ?? "")}
            display={node.type === "mathBlock"}
          />
        );
      }
      if (node.type === "footnoteReference") {
        const identifier = String(node.attrs?.identifier ?? "");
        return (
          <sup className="markdown-footnote-reference" key={key}>
            [{identifier}]
          </sup>
        );
      }
      if (node.type === "hardBreak") return <br key={key} />;
      if (node.type === "table") {
        const rows = node.content ?? [];
        const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
        const renderRow = (row: RichNode, rowIndex: number) => (
          <tr key={`${key}-row-${rowIndex}`}>
            {(row.content ?? []).map((cell, cellIndex) => {
              const Cell = cell.attrs?.header ? "th" : "td";
              const cellAlign = cell.attrs?.align ?? align[cellIndex];
              const colSpan = Math.min(
                50,
                Math.max(1, Number(cell.attrs?.colspan ?? 1)),
              );
              const rowSpan = Math.min(
                500,
                Math.max(1, Number(cell.attrs?.rowspan ?? 1)),
              );
              return (
                <Cell
                  key={`${key}-cell-${rowIndex}-${cellIndex}`}
                  colSpan={colSpan}
                  rowSpan={rowSpan}
                  scope={
                    Cell === "th"
                      ? rowSpan > 1
                        ? "rowgroup"
                        : colSpan > 1
                        ? "colgroup"
                        : "col"
                      : undefined
                  }
                  style={
                    cellAlign === "left" ||
                    cellAlign === "right" ||
                    cellAlign === "center"
                      ? { textAlign: cellAlign }
                      : undefined
                  }
                >
                  {renderNodes(
                    cell.content ?? [],
                    `${key}-cell-${rowIndex}-${cellIndex}`,
                  )}
                </Cell>
              );
            })}
          </tr>
        );
        return (
          <div
            className="markdown-table-scroll"
            key={key}
            role="region"
            aria-label={text("Scrollable table", "Scrollbare Tabelle")}
            tabIndex={0}
          >
            <table>
              {rows[0] &&
              (rows[0].content ?? []).every((cell) => cell.attrs?.header) ? (
                <thead>{renderRow(rows[0], 0)}</thead>
              ) : null}
              {rows.length ? (
                <tbody>
                  {(rows[0]?.content ?? []).every((cell) => cell.attrs?.header)
                    ? rows
                        .slice(1)
                        .map((row, rowIndex) => renderRow(row, rowIndex + 1))
                    : rows.map((row, rowIndex) => renderRow(row, rowIndex))}
                </tbody>
              ) : null}
            </table>
          </div>
        );
      }
      const children = renderNodes(node.content ?? [], key);
      if (node.type === "heading") {
        const level = Number(node.attrs?.level ?? 2);
        if (level === 1) return <h1 key={key}>{children}</h1>;
        if (level === 3) return <h3 key={key}>{children}</h3>;
        if (level === 4) return <h4 key={key}>{children}</h4>;
        if (level === 5) return <h5 key={key}>{children}</h5>;
        if (level === 6) return <h6 key={key}>{children}</h6>;
        return <h2 key={key}>{children}</h2>;
      }
      if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
      if (node.type === "orderedList")
        return (
          <ol key={key} start={Number(node.attrs?.start ?? 1)}>
            {children}
          </ol>
        );
      if (node.type === "listItem") {
        const checked =
          typeof node.attrs?.checked === "boolean"
            ? node.attrs.checked
            : undefined;
        return (
          <li
            className={checked === undefined ? undefined : "task-list-item"}
            key={key}
          >
            {checked === undefined ? null : (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                aria-label={
                  checked
                    ? text("Completed task", "Erledigte Aufgabe")
                    : text("Open task", "Offene Aufgabe")
                }
              />
            )}
            {children}
          </li>
        );
      }
      if (node.type === "blockquote")
        return <blockquote key={key}>{children}</blockquote>;
      if (node.type === "codeBlock")
        return (
          <pre key={key}>
            <code>{children}</code>
          </pre>
        );
      if (node.type === "horizontalRule") return <hr key={key} />;
      if (node.type === "footnoteDefinition") {
        return (
          <aside className="markdown-footnote" key={key}>
            <strong>[{String(node.attrs?.identifier ?? "")}]</strong> {children}
          </aside>
        );
      }
      if (node.type === "tableRow" || node.type === "tableCell") {
        return <>{children}</>;
      }
      return <p key={key}>{children}</p>;
    });

  return <>{renderNodes(block.document.content, "rich")}</>;
}
