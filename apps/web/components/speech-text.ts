import {
  ankiClozeParts,
  ankiClozePlainText,
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

export const removeParentheticalTextFromSpeechText = (
  value: string,
): string => {
  const openIndexes: number[] = [];
  const ranges: Array<readonly [number, number]> = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") {
      openIndexes.push(index);
    } else if (value[index] === ")" && openIndexes.length) {
      const start = openIndexes.pop()!;
      if (openIndexes.length === 0) ranges.push([start, index + 1]);
    }
  }
  if (!ranges.length) return value;
  let cursor = 0;
  const visible: string[] = [];
  for (const [start, end] of ranges) {
    visible.push(value.slice(cursor, start), " ");
    cursor = end;
  }
  visible.push(value.slice(cursor));
  return visible.join("");
};

export const insertSpeechPausesAtLineBreaks = (value: string): string =>
  value
    .replace(/([.!?;:,])[\t ]*(?:\r\n?|\n)+[\t ]*/gu, "$1 ")
    .replace(/[\t ]*(?:\r\n?|\n)+[\t ]*/gu, ". ");

const normalizeSpeechText = (value: string): string =>
  insertSpeechPausesAtLineBreaks(
    removeParentheticalTextFromSpeechText(removeUrlsFromSpeechText(value)),
  )
    .replace(/(^|\s)[,;:.!?]+(?=\s|$)/gu, " ")
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
        if (node.type === "tableCell" && node.attrs?.speak === false) return "";
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
      if (
        block.type === "cloze" &&
        block.presentation === "ANKI" &&
        block.activeDeletionId !== undefined
      ) {
        return revealAnswers
          ? ankiClozePlainText(block, block.activeDeletionId, true)
          : ankiClozeParts(block, block.activeDeletionId, false)
              .map((part) => (part.kind === "blank" ? "…" : part.text))
              .join("");
      }
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
