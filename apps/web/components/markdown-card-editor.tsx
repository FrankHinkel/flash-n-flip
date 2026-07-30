"use client";

import type { MarkdownBlock } from "@flashcards/domain/content";

import { useI18n } from "./i18n-provider";

export function MarkdownCardEditor({
  value,
  onChange,
  label,
}: {
  value: MarkdownBlock;
  onChange: (value: MarkdownBlock) => void;
  label: string;
}) {
  const { text } = useI18n();

  return (
    <div className="markdown-card-editor">
      <textarea
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
        <details>
          <summary>
            {text("Markdown and cloze help", "Markdown- und Lückenhilfe")}
          </summary>
          <div className="markdown-editor-help">
            <code>## {text("Heading", "Überschrift")}</code>
            <code>
              **{text("bold", "fett")}** · *{text("italic", "kursiv")}*
            </code>
            <code>{"{{1:hund|katze|maus}}"}</code>
            <code>{"{{hund|+4}}"}</code>
            <code>{"{{hund}}"}</code>
            <code>
              {"| Person | Verb |\n| --- | --- |\n| ich | {{gehe|gehst}} |"}
            </code>
            <code>{"$A = \\\\pi r^2$"}</code>
            <code>{"$$\n\\\\int_0^1 x^2\\\\,dx\n$$"}</code>
            <p>
              {text(
                "The first cloze value is correct. +N adds answers from other clozes. Tables may contain clozes; $…$ and $$…$$ render formulas.",
                "Der erste Lückenwert ist richtig. +N ergänzt Antworten aus anderen Lücken. Tabellen dürfen Lücken enthalten; $…$ und $$…$$ stellen Formeln dar.",
              )}
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
