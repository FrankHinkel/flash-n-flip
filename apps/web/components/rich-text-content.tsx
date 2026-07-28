"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  RichTextBlock,
  RichTextDocument,
} from "@flashcards/domain/content";

import { useI18n } from "./i18n-provider";
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
  const [placement, setPlacement] = useState<"below" | "above">("below");
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
    const menu = menuRef.current.getBoundingClientRect();
    const card = containerRef.current.closest("[data-study-card]");
    const limit = Math.min(
      window.innerHeight - 10,
      card ? card.getBoundingClientRect().bottom - 10 : window.innerHeight - 10,
    );
    setPlacement(menu.bottom > limit ? "above" : "below");
  }, [open]);

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
            setPlacement("below");
            setOpen((current) => !current);
          }
        }}
      >
        {attrs.hint ? String(attrs.hint) : "…"}
      </button>
      {open && (
        <span
          className={`cloze-choice-menu ${placement}`}
          role="group"
          ref={menuRef}
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
    return <code key={`${key}-code-${index}`}>{current}</code>;
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
      const children = renderNodes(node.content ?? [], key);
      if (node.type === "heading") {
        return Number(node.attrs?.level) === 3 ? (
          <h3 key={key}>{children}</h3>
        ) : (
          <h2 key={key}>{children}</h2>
        );
      }
      if (node.type === "bulletList") return <ul key={key}>{children}</ul>;
      if (node.type === "orderedList") return <ol key={key}>{children}</ol>;
      if (node.type === "listItem") return <li key={key}>{children}</li>;
      return <p key={key}>{children}</p>;
    });

  return <>{renderNodes(block.document.content, "rich")}</>;
}
