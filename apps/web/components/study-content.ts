import type { CardContent } from "@flashcards/domain/content";

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
