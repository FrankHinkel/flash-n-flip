"use client";

import { useMemo } from "react";

import type { MarkdownBlock } from "@flashcards/domain/content";
import {
  markdownContentReferenceDiagnostics,
  markdownToRichTextDocument,
} from "@flashcards/domain/markdown";

import { useI18n } from "./i18n-provider";

export function MarkdownCardEditor({
  value,
  onChange,
  label,
  textareaId,
}: {
  value: MarkdownBlock;
  onChange: (value: MarkdownBlock) => void;
  label: string;
  textareaId?: string;
}) {
  const { text } = useI18n();
  const referenceDiagnostics = useMemo(() => {
    try {
      return markdownContentReferenceDiagnostics(
        markdownToRichTextDocument(value.source),
      );
    } catch {
      return [];
    }
  }, [value.source]);

  return (
    <div className="markdown-card-editor">
      <textarea
        id={textareaId}
        aria-label={label}
        value={value.source}
        rows={9}
        spellCheck
        onChange={(event) =>
          onChange({ ...value, source: event.currentTarget.value })
        }
      />
      {referenceDiagnostics.length ? (
        <ul
          className="markdown-content-reference-diagnostics"
          aria-live="polite"
        >
          {referenceDiagnostics.map((diagnostic) => (
            <li
              data-severity={
                diagnostic.code === "UNUSED_DEFINITION" ? "warning" : "error"
              }
              key={`${diagnostic.code}:${diagnostic.name}`}
            >
              {diagnostic.code === "DUPLICATE_DEFINITION"
                ? text(
                    `“${diagnostic.name}” is defined more than once.`,
                    `„${diagnostic.name}“ ist mehrfach definiert.`,
                  )
                : diagnostic.code === "UNRESOLVED_REFERENCE"
                  ? text(
                      `The definition for “${diagnostic.name}” is missing.`,
                      `Für „${diagnostic.name}“ fehlt eine Definition.`,
                    )
                  : text(
                      `“${diagnostic.name}” is not yet used with ![[${diagnostic.name}]].`,
                      `„${diagnostic.name}“ wird noch nicht mit ![[${diagnostic.name}]] verwendet.`,
                    )}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="markdown-editor-footer">
        <label>
          <span>{text("Cloze reveal", "Lücken aufdecken")}</span>
          <select
            value={value.revealMode}
            onChange={(event) =>
              onChange({
                ...value,
                revealMode: event.currentTarget
                  .value as MarkdownBlock["revealMode"],
              })
            }
          >
            <option value="AUTO">{text("Automatic", "Automatisch")}</option>
            <option value="ALL">
              {text("All at once", "Alle gleichzeitig")}
            </option>
            <option value="SEQUENTIAL">
              {text("In sequence", "Nacheinander")}
            </option>
          </select>
        </label>
      </div>
    </div>
  );
}
