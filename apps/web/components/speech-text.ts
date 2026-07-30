import {
  markdownToRichTextDocument,
  type CardContent,
  type RichTextDocument,
} from "@flashcards/domain/content";
import { parseMarkdownInlineMath } from "@flashcards/domain/markdown";

type RichNode = RichTextDocument["content"][number];

const normalizeSpeechText = (value: string): string =>
  value
    .replace(/\s*…\s*/g, " … ")
    .replace(/\s+/g, " ")
    .trim();

function richNodesToSpeechText(
  nodes: readonly RichNode[],
  revealAnswers: boolean,
): string {
  return normalizeSpeechText(
    nodes
      .map((node) => {
        if (node.type === "text") return node.text ?? "";
        if (node.type === "cloze") {
          return revealAnswers ? String(node.attrs?.answer ?? "") : "…";
        }
        if (node.type === "hardBreak") return ". ";
        if (node.type === "mathInline" || node.type === "mathBlock") {
          return String(node.attrs?.latex ?? "");
        }
        return richNodesToSpeechText(node.content ?? [], revealAnswers);
      })
      .join(" "),
  );
}

export function cardContentToSpeechText(
  content: CardContent,
  revealAnswers: boolean,
): string {
  const parts = content.blocks.flatMap((block) => {
    if (block.type === "richText") {
      return richNodesToSpeechText(block.document.content, revealAnswers);
    }
    if (block.type === "markdown") {
      try {
        return richNodesToSpeechText(
          markdownToRichTextDocument(block.source).content,
          revealAnswers,
        );
      } catch {
        return "";
      }
    }
    if (block.type === "heading" || block.type === "cloze") {
      return block.text;
    }
    if (block.type === "list") return block.items.join(". ");
    if (block.type === "formula") return block.latex;
    if (block.type === "audio") return block.transcript ?? block.label;
    if (block.type === "video") return block.captions ?? block.label;
    if (block.type === "graphic" || block.type === "animation") {
      return block.label;
    }
    if (block.type === "image" || block.type === "imageOverlay") {
      return block.decorative ? "" : block.alt;
    }
    return "";
  });
  return normalizeSpeechText(parts.join(". "));
}

export function clozeChoiceToSpeechText(choice: string): string {
  return normalizeSpeechText(
    parseMarkdownInlineMath(choice)
      .map((segment) => segment.value)
      .join(" "),
  );
}
