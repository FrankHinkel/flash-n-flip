"use client";

import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Braces,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
} from "lucide-react";
import { useState } from "react";

import {
  richTextDocumentSchema,
  type RichTextBlock,
} from "@flashcards/domain/content";

import { useI18n } from "./i18n-provider";

const ClozeNode = Node.create({
  name: "cloze",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: "" },
      answer: { default: "" },
      choices: { default: [] },
      order: { default: 1 },
      hint: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-fnf-cloze]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-fnf-cloze": "" }),
      `{{${String(HTMLAttributes.answer)}}}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(({ node, selected }) => (
      <NodeViewWrapper
        as="span"
        className={`editor-cloze ${selected ? "selected" : ""}`}
        data-fnf-cloze=""
      >
        {"{{"}
        {String(node.attrs.answer)}
        {Array.isArray(node.attrs.choices) && node.attrs.choices.length > 1
          ? ` | ${node.attrs.choices.slice(1).join(" | ")}`
          : ""}
        {"}}"}
      </NodeViewWrapper>
    ));
  },
});

const ToolbarButton = ({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    className={active ? "active" : ""}
    aria-label={label}
    aria-pressed={active}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

export function RichTextCardEditor({
  value,
  onChange,
  label,
}: {
  value: RichTextBlock;
  onChange: (value: RichTextBlock) => void;
  label: string;
}) {
  const { text } = useI18n();
  const [clozeFormOpen, setClozeFormOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [alternatives, setAlternatives] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, ClozeNode],
    content: value.document as JSONContent,
    editorProps: {
      attributes: {
        class: "rich-text-editor-content",
        "aria-label": label,
      },
    },
    onUpdate({ editor: current }) {
      const parsed = richTextDocumentSchema.safeParse(current.getJSON());
      if (parsed.success) {
        onChange({ ...value, document: parsed.data });
      }
    },
  });

  const openClozeForm = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setAnswer(editor.state.doc.textBetween(from, to, " ").trim());
    setAlternatives("");
    setClozeFormOpen(true);
  };

  const insertCloze = () => {
    if (!editor || !answer.trim()) return;
    const distractors = alternatives
      .split("|")
      .map((choice) => choice.trim())
      .filter(
        (choice, index, choices) =>
          choice &&
          choice !== answer.trim() &&
          choices.indexOf(choice) === index,
      );
    const order = editor.state.doc.descendants
      ? (() => {
          let count = 0;
          editor.state.doc.descendants((node) => {
            if (node.type.name === "cloze") count += 1;
          });
          return count + 1;
        })()
      : 1;
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent({
        type: "cloze",
        attrs: {
          id: crypto.randomUUID(),
          answer: answer.trim(),
          choices: [answer.trim(), ...distractors],
          order,
        },
      })
      .run();
    setClozeFormOpen(false);
  };

  if (!editor) return null;

  return (
    <div className="rich-text-editor">
      <div
        className="rich-text-toolbar"
        role="toolbar"
        aria-label={text("Text formatting", "Textformatierung")}
      >
        <ToolbarButton
          label={text("Bold", "Fett")}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label={text("Italic", "Kursiv")}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label={text("Strikethrough", "Durchgestrichen")}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          label={text("Inline code", "Inline-Code")}
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code />
        </ToolbarButton>
        <ToolbarButton
          label={text("Heading 2", "Überschrift 2")}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label={text("Heading 3", "Überschrift 3")}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 />
        </ToolbarButton>
        <ToolbarButton
          label={text("Bullet list", "Aufzählung")}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label={text("Numbered list", "Nummerierte Liste")}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label={text("Insert cloze", "Lückentext einfügen")}
          onClick={openClozeForm}
        >
          <Braces />
        </ToolbarButton>
        <label className="reveal-mode">
          <span>{text("Reveal", "Aufdecken")}</span>
          <select
            value={value.revealMode}
            onChange={(event) =>
              onChange({
                ...value,
                revealMode: event.target.value as RichTextBlock["revealMode"],
              })
            }
          >
            <option value="ALL">{text("all at once", "als Ganzes")}</option>
            <option value="SEQUENTIAL">
              {text("in order", "in Reihenfolge")}
            </option>
          </select>
        </label>
      </div>
      {clozeFormOpen && (
        <div className="cloze-editor-form" role="group">
          <label>
            {text("Correct answer", "Richtige Antwort")}
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              autoFocus
              maxLength={500}
            />
          </label>
          <label>
            {text(
              "Alternatives, separated with |",
              "Vorschläge, getrennt mit |",
            )}
            <input
              value={alternatives}
              onChange={(event) => setAlternatives(event.target.value)}
              placeholder="bist | bin"
              maxLength={2000}
            />
          </label>
          <div>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setClozeFormOpen(false)}
            >
              {text("Cancel", "Abbrechen")}
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!answer.trim()}
              onClick={insertCloze}
            >
              {text("Insert cloze", "Lücke einfügen")}
            </button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
      <p className="editor-hint">
        {text(
          "Tip: select a word, then choose the braces button. In “sind | bist | bin”, the selected word remains the correct first choice.",
          "Tipp: Markiere ein Wort und wähle dann die geschweiften Klammern. Bei „sind | bist | bin“ bleibt das markierte Wort die richtige erste Auswahl.",
        )}
      </p>
    </div>
  );
}
