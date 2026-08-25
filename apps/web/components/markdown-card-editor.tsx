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
                ? text("legacy.2238ce978484", [diagnostic.name])
                : diagnostic.code === "UNRESOLVED_REFERENCE"
                  ? text("legacy.5cdda4b4fe57", [diagnostic.name])
                  : text("legacy.a8410e51e010", [
                      diagnostic.name,
                      diagnostic.name,
                    ])}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="markdown-editor-footer">
        <label>
          <span>{text("legacy.b5658ac8ff28")}</span>
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
            <option value="AUTO">{text("legacy.1b74f2ea14b8")}</option>
            <option value="ALL">{text("legacy.11400c325078")}</option>
            <option value="SEQUENTIAL">{text("legacy.1ed8782d1a90")}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
