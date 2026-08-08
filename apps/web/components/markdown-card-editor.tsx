"use client";

import type { MarkdownBlock } from "@flashcards/domain/content";

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
