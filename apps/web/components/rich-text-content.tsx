"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import { Check, Copy, Square, Volume2 } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type {
  RichTextBlock,
  RichTextDocument,
} from "@flashcards/domain/content";
import type { ContentStyleDefinition } from "@flashcards/domain/content-style";
import {
  parseMarkdownInlineMath,
  type MarkdownRichDocument,
  type MarkdownRichNode,
} from "@flashcards/domain/markdown";

import { useI18n } from "./i18n-provider";
import { MermaidDiagram } from "./mermaid-diagram";
import { JsxGraph } from "./jsx-graph";
import { MusicScore } from "./music-score";
import {
  jsxGraphFromMarkdownSource,
  parseJsxGraphPresentation,
} from "../lib/jsx-graph-markdown";
import {
  mermaidDiagramFromMarkdownSource,
  parseMermaidDiagramPresentation,
} from "../lib/mermaid-markdown";
import { musicScoresFromMarkdownSource } from "../lib/music-markdown";
import { fitPopupToViewport, type PopupLayout } from "./popup-position";
import { clozeChoiceToSpeechText } from "./speech-text";
import { completedClozeIds } from "./study-content";

type RichNode = RichTextDocument["content"][number] | MarkdownRichNode;
type RenderableRichTextBlock = Omit<RichTextBlock, "document"> & {
  document: RichTextDocument | MarkdownRichDocument;
};

const readableMathMacros = {
  "\\mathclap": "{#1}",
  "\\mathllap": "{#1}",
  "\\mathrlap": "{#1}",
} as const;

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

export function MathContent({
  latex,
  display,
}: {
  latex: string;
  display: boolean;
}) {
  const rendered = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        output: "htmlAndMathml",
        throwOnError: true,
        strict: "ignore",
        trust: false,
        maxExpand: 1000,
        maxSize: 20,
        macros: { ...readableMathMacros },
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

function ClozeInlineContent({ value }: { value: string }) {
  return parseMarkdownInlineMath(value).map((segment, index) =>
    segment.type === "math" ? (
      <MathContent
        display={false}
        key={`math-${index}-${segment.value}`}
        latex={segment.value}
      />
    ) : (
      <span key={`text-${index}`}>{segment.value}</span>
    ),
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
  canSpeakChoices,
  speakingText,
  onSpeakChoice,
}: {
  attrs: Record<string, unknown>;
  revealed: boolean;
  enabled: boolean;
  seed: string;
  onCorrect: () => void;
  onIncorrect: () => void;
  canSpeakChoices: boolean;
  speakingText: string;
  onSpeakChoice?: (choice: string) => void;
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
      if (
        !containerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
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
      const studyCard =
        containerRef.current.closest<HTMLElement>("[data-study-card]");
      const studyCardRect = studyCard?.getBoundingClientRect();
      const revealButton =
        studyCard?.querySelector<HTMLElement>(".reveal-button");
      const revealButtonRect = revealButton?.getBoundingClientRect();
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportBottom =
        viewportTop + (visualViewport?.height ?? window.innerHeight);
      const protectedBottom = Math.min(
        viewportBottom,
        studyCardRect ? studyCardRect.bottom - 8 : viewportBottom,
        revealButtonRect ? revealButtonRect.top - 8 : viewportBottom,
      );
      const previousWidth = menuRef.current.style.width;
      const previousMaxHeight = menuRef.current.style.maxHeight;
      menuRef.current.style.removeProperty("width");
      menuRef.current.style.removeProperty("max-height");
      const menu = menuRef.current.getBoundingClientRect();
      menuRef.current.style.width = previousWidth;
      menuRef.current.style.maxHeight = previousMaxHeight;
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
          verticalBounds: {
            top: Math.max(
              viewportTop,
              studyCardRect ? studyCardRect.top + 8 : viewportTop,
            ),
            bottom: protectedBottom,
          },
        }),
      );
    };
    const handleScroll = (event: Event) => {
      if (event.target !== menuRef.current) updatePosition();
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    visualViewport?.addEventListener("resize", updatePosition);
    visualViewport?.addEventListener("scroll", updatePosition);
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>(".cloze-choice-value")
        ?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", handleScroll, true);
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

  if (revealed)
    return (
      <span className="cloze-answer">
        <ClozeInlineContent value={answer} />
      </span>
    );

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
      {open &&
        createPortal(
          <span
            className={`cloze-choice-menu ${popupLayout?.placement ?? "below"}`}
            role="group"
            ref={menuRef}
            style={popupStyle}
          >
            <span className="sr-only">
              {text("Choose the missing answer", "Wähle die fehlende Antwort")}
            </span>
            {shuffled.map((choice) => {
              const spokenChoice = clozeChoiceToSpeechText(choice);
              const choiceIsSpeaking = speakingText === spokenChoice;
              const choiceCanWrap = spokenChoice
                .split(/\s+/u)
                .some((word) => word.length > 18);
              return (
                <span className="cloze-choice-option" key={choice}>
                  <button
                    type="button"
                    className={`cloze-choice-value${choiceCanWrap ? " cloze-choice-value--breakable" : ""}`}
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
                    <ClozeInlineContent value={choice} />
                  </button>
                  {canSpeakChoices && spokenChoice ? (
                    <button
                      type="button"
                      className="cloze-choice-speech"
                      aria-label={
                        choiceIsSpeaking
                          ? text("Stop hint", "Hinweis stoppen")
                          : text(
                              `Hear ${spokenChoice} as a hint`,
                              `${spokenChoice} als Hinweis anhören`,
                            )
                      }
                      title={text(
                        "Listen as a hint; Easy will become unavailable",
                        "Als Hinweis anhören; Leicht wird danach gesperrt",
                      )}
                      onClick={() => onSpeakChoice?.(choice)}
                    >
                      {choiceIsSpeaking ? (
                        <Square aria-hidden="true" size={14} />
                      ) : (
                        <Volume2 aria-hidden="true" size={16} />
                      )}
                    </button>
                  ) : null}
                </span>
              );
            })}
            {error && (
              <span className="cloze-feedback" role="status">
                {error}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}

const contentStyleProperties = (style: ContentStyleDefinition): CSSProperties =>
  ({
    "--content-style-bright-color": style.bright.color,
    "--content-style-bright-background": style.bright.backgroundColor,
    "--content-style-bright-weight": style.bright.fontWeight,
    "--content-style-bright-font-style": style.bright.fontStyle,
    "--content-style-bright-decoration": style.bright.textDecoration,
    "--content-style-dark-color": style.dark.color,
    "--content-style-dark-background": style.dark.backgroundColor,
    "--content-style-dark-weight": style.dark.fontWeight,
    "--content-style-dark-font-style": style.dark.fontStyle,
    "--content-style-dark-decoration": style.dark.textDecoration,
  }) as CSSProperties;

const withMarks = (
  value: ReactNode,
  marks: RichNode["marks"],
  key: string,
  contentStyles: ReadonlyMap<string, ContentStyleDefinition>,
) =>
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
    if (mark.type === "contentStyle") {
      const style = contentStyles.get(mark.attrs.name);
      return style ? (
        <span
          className="card-content-style"
          data-content-style={style.name}
          key={`${key}-content-style-${index}`}
          style={contentStyleProperties(style)}
        >
          {current}
        </span>
      ) : (
        current
      );
    }
    if (mark.type === "link") {
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

const withTextLineBreaks = (value: string, key: string): ReactNode => {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length === 1) return value;
  return lines.map((line, index) => (
    <Fragment key={`${key}-line-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
};

export function RichTextContent({
  block,
  answer = false,
  shuffleSeed = "preview",
  onClozeCorrect,
  onClozeIncorrect,
  canSpeakChoices = false,
  speakingText = "",
  onSpeakChoice,
  trailingContent,
  styles = [],
  contentLocale,
}: {
  block: RenderableRichTextBlock;
  answer?: boolean;
  shuffleSeed?: string;
  onClozeCorrect?: (clozeId: string) => void;
  onClozeIncorrect?: () => void;
  canSpeakChoices?: boolean;
  speakingText?: string;
  onSpeakChoice?: (choice: string) => void;
  trailingContent?: ReactNode;
  styles?: readonly ContentStyleDefinition[];
  contentLocale?: string;
}) {
  const { locale: uiLocale, text } = useI18n();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedCodeKey, setCopiedCodeKey] = useState("");
  const contentStyles = useMemo(
    () => new Map(styles.map((style) => [style.name, style])),
    [styles],
  );
  const contentDefinitions = useMemo(() => {
    const definitions = new Map<string, RichNode[]>();
    const visit = (node: RichNode) => {
      const definitionName =
        node.type === "codeBlock" &&
        typeof node.attrs?.definitionName === "string"
          ? node.attrs.definitionName
          : "";
      if (definitionName) {
        definitions.set(definitionName, [
          ...(definitions.get(definitionName) ?? []),
          node,
        ]);
      }
      node.content?.forEach(visit);
    };
    block.document.content.forEach(visit);
    return definitions;
  }, [block.document]);
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

  const renderNodes = (
    nodes: RichNode[],
    path: string,
    trailing?: ReactNode,
    allowContentReference = false,
  ): ReactNode =>
    nodes.map((node, index) => {
      const key = `${path}-${index}`;
      const nodeTrailing = index === nodes.length - 1 ? trailing : undefined;
      if (node.type === "text") {
        const renderedText = withTextLineBreaks(node.text ?? "", key);
        return nodeTrailing ? (
          <span key={key}>
            {withMarks(renderedText, node.marks, key, contentStyles)}
            {nodeTrailing}
          </span>
        ) : (
          withMarks(renderedText, node.marks, key, contentStyles)
        );
      }
      if (node.type === "cloze") {
        const id = String(node.attrs?.id ?? key);
        return (
          <span key={key}>
            <ChoiceCloze
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
              canSpeakChoices={canSpeakChoices}
              speakingText={speakingText}
              onSpeakChoice={onSpeakChoice}
            />
            {nodeTrailing}
          </span>
        );
      }
      if (node.type === "mathInline" || node.type === "mathBlock") {
        return nodeTrailing ? (
          <Fragment key={key}>
            <MathContent
              latex={String(node.attrs?.latex ?? "")}
              display={node.type === "mathBlock"}
            />
            {nodeTrailing}
          </Fragment>
        ) : (
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
      if (node.type === "contentReference") {
        const name = String(node.attrs?.name ?? "");
        const definitions = contentDefinitions.get(name) ?? [];
        const error = !allowContentReference
          ? text(
              "Embedded content must be the only content in a paragraph or table cell.",
              "Eingebetteter Inhalt muss allein in einem Absatz oder einer Tabellenzelle stehen.",
            )
          : definitions.length === 0
            ? text(
                `The content definition “${name}” does not exist.`,
                `Die Inhaltsdefinition „${name}“ ist nicht vorhanden.`,
              )
            : definitions.length > 1
              ? text(
                  `The content definition “${name}” occurs more than once.`,
                  `Die Inhaltsdefinition „${name}“ kommt mehrfach vor.`,
                )
              : "";
        if (error) {
          return (
            <span
              className="markdown-content-reference-error"
              key={key}
              role="alert"
            >
              {error}
            </span>
          );
        }
        const definition = definitions[0]!;
        const { definitionName: _definitionName, ...attrs } =
          definition.attrs ?? {};
        return (
          <div
            className="markdown-content-embed"
            data-content-reference={name}
            key={key}
          >
            {renderNodes(
              [{ ...definition, attrs } as RichNode],
              `${key}-definition`,
            )}
          </div>
        );
      }
      if (node.type === "table") {
        const rows = node.content ?? [];
        const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
        const renderRow = (row: RichNode, rowIndex: number) => {
          const headerRow = (row.content ?? []).every(
            (cell) => cell.attrs?.header,
          );
          return (
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
                const containsContentReference = (cell.content ?? []).some(
                  (child) => child.type === "contentReference",
                );
                return (
                  <Cell
                    key={`${key}-cell-${rowIndex}-${cellIndex}`}
                    className={
                      containsContentReference
                        ? "markdown-table-content-cell"
                        : undefined
                    }
                    colSpan={colSpan}
                    rowSpan={rowSpan}
                    scope={
                      Cell === "th"
                        ? headerRow
                          ? colSpan > 1
                            ? "colgroup"
                            : "col"
                          : rowSpan > 1
                            ? "rowgroup"
                            : "row"
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
                      undefined,
                      true,
                    )}
                  </Cell>
                );
              })}
            </tr>
          );
        };
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
      if (
        node.type === "paragraph" &&
        node.content?.length === 1 &&
        node.content[0]?.type === "contentReference"
      ) {
        return (
          <Fragment key={key}>
            {renderNodes(node.content, key, undefined, true)}
            {nodeTrailing}
          </Fragment>
        );
      }
      const children = renderNodes(node.content ?? [], key, nodeTrailing);
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
      if (node.type === "codeBlock") {
        if (typeof node.attrs?.definitionName === "string") return null;
        const code = (node.content ?? [])
          .map((child) => child.text ?? "")
          .join("");
        const language = String(node.attrs?.language ?? "").toLowerCase();
        const contentLanguage =
          (contentLocale ?? uiLocale).split("-")[0] === "de" ? "de" : "en";
        const diagram =
          language === "mermaid"
            ? mermaidDiagramFromMarkdownSource(code, contentLanguage)
            : null;
        const presentation = diagram
          ? parseMermaidDiagramPresentation(node.attrs?.meta)
          : null;
        if (diagram && presentation)
          return (
            <MermaidDiagram
              block={diagram}
              key={key}
              presentation={presentation}
            />
          );
        const graph =
          language === "jsxgraph" || language === "jxg"
            ? jsxGraphFromMarkdownSource(code, contentLanguage)
            : null;
        const graphPresentation = graph
          ? parseJsxGraphPresentation(node.attrs?.meta)
          : null;
        if (graph && graphPresentation)
          return (
            <JsxGraph
              block={graph}
              key={key}
              presentation={graphPresentation}
            />
          );
        const scores =
          language === "music" || language === "abc"
            ? musicScoresFromMarkdownSource(
                code,
                contentLanguage,
                node.attrs?.meta,
              )
            : [];
        if (scores.length > 0)
          return (
            <div className="music-score-book" key={key}>
              {scores.map((score, scoreIndex) => (
                <MusicScore
                  key={`${key}-${scoreIndex}-${score.label}`}
                  score={score}
                />
              ))}
            </div>
          );
        const copied = copiedCodeKey === key;
        return (
          <div className="markdown-code-block" key={key}>
            <pre>
              <code>{children}</code>
            </pre>
            <button
              type="button"
              aria-label={
                copied
                  ? text("Source copied", "Quelltext kopiert")
                  : text("Copy source", "Quelltext kopieren")
              }
              onClick={() => {
                if (!navigator.clipboard) return;
                void navigator.clipboard
                  .writeText(code)
                  .then(() => {
                    setCopiedCodeKey(key);
                  })
                  .catch(() => {
                    setCopiedCodeKey("");
                  });
              }}
            >
              {copied ? (
                <Check size={20} aria-hidden="true" />
              ) : (
                <Copy size={20} aria-hidden="true" />
              )}
            </button>
          </div>
        );
      }
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

  return <>{renderNodes(block.document.content, "rich", trailingContent)}</>;
}
