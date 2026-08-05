import {
  markdownToRichTextDocument,
  type CardContent,
  type RichTextDocument,
} from "@flashcards/domain/content";
import { parseMarkdownInlineMath } from "@flashcards/domain/markdown";

import {
  segmentSpeechTextByLanguage,
  type SpeechSegment,
} from "./mixed-language-speech";

type RichNode = RichTextDocument["content"][number];

const importedHintHeadingPattern = /^(?:hinweis|hint)$/iu;

const speechUrlPattern =
  /(?:https?:\/\/|ftp:\/\/|file:\/\/|blob:|data:(?:image|audio|video)\/|www\.)[^\s<>"']+|\/(?:api\/)?(?:media|uploads?)\/[^\s<>"']+/giu;

export const removeUrlsFromSpeechText = (value: string): string =>
  value.replace(speechUrlPattern, " ");

const normalizeSpeechText = (value: string): string =>
  removeUrlsFromSpeechText(value)
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
    if (block.type === "text" || block.type === "cloze") {
      return block.text;
    }
    if (block.type === "heading") {
      return importedHintHeadingPattern.test(block.text.trim())
        ? ""
        : block.text;
    }
    if (block.type === "list") return block.items.join(". ");
    if (block.type === "formula") return block.latex;
    if (block.type === "audio") return block.transcript ?? "";
    if (block.type === "video") return block.captions ?? block.label;
    if (block.type === "graphic" || block.type === "animation") {
      return block.label;
    }
    if (block.type === "image" || block.type === "imageOverlay") {
      return block.decorative ? "" : block.alt;
    }
    return "";
  });
  return normalizeSpeechText(
    parts.filter((part) => Boolean(part.trim())).join(". "),
  );
}

export function cardContentToSpeechSegments(
  content: CardContent,
  revealAnswers: boolean,
  primaryLocale: string,
  alternateLocale?: string,
): SpeechSegment[] {
  return segmentSpeechTextByLanguage(
    cardContentToSpeechText(content, revealAnswers),
    primaryLocale,
    alternateLocale,
  );
}

export type { SpeechSegment } from "./mixed-language-speech";

export function clozeChoiceToSpeechText(choice: string): string {
  return normalizeSpeechText(
    parseMarkdownInlineMath(choice)
      .map((segment) => segment.value)
      .join(" "),
  );
}
