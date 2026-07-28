import type { CardContent, RichTextDocument } from "@flashcards/domain/content";
import type { ReviewRating } from "@flashcards/domain";

export type StudyContentHeading = {
  level: 2 | 3;
  text: string;
};

export function firstStudyContentHeading(
  content: CardContent,
): StudyContentHeading | null {
  const firstBlock = content.blocks[0];
  return firstBlock?.type === "heading"
    ? { level: firstBlock.level, text: firstBlock.text }
    : null;
}

export function hasStudyMap(content: CardContent): boolean {
  return content.blocks.some(
    (block) => block.type === "europeMap" || block.type === "geographyMap",
  );
}

export function visibleStudyContentBlocks(
  content: CardContent,
  skipFirstHeading: boolean,
): CardContent["blocks"] {
  if (!skipFirstHeading || content.blocks[0]?.type !== "heading") {
    return content.blocks;
  }
  return content.blocks.slice(1);
}

type RichTextNode = RichTextDocument["content"][number];

export function interactiveClozeIds(content: CardContent): string[] {
  const ids: string[] = [];
  content.blocks.forEach((block, blockIndex) => {
    if (block.type !== "richText") return;
    const visit = (node: RichTextNode) => {
      if (node.type === "cloze") {
        ids.push(`${blockIndex}:${String(node.attrs?.id ?? "")}`);
      }
      node.content?.forEach(visit);
    };
    block.document.content.forEach(visit);
  });
  return ids;
}

export function completedClozeIds(
  revealMode: "ALL" | "SEQUENTIAL",
  allIds: readonly string[],
  selectedId: string,
): string[] {
  return revealMode === "ALL" ? [...allIds] : [selectedId];
}

const ratingRank: Record<ReviewRating, number> = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
};

export function isRatingAllowedAfterClozeErrors(
  rating: ReviewRating,
  errorCount: number,
): boolean {
  const disabledLevels = Math.min(3, Math.max(0, errorCount));
  return ratingRank[rating] <= 3 - disabledLevels;
}
