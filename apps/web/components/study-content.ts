import {
  parseMarkdownClozes,
  type CardContent,
  type RichTextDocument,
} from "@flashcards/domain/content";
import type { ReviewRating } from "@flashcards/domain";
import { geographyMapLevels } from "@flashcards/domain/geography";

export type StudyContentHeading = {
  level: 2 | 3;
  text: string;
};

export type MapQuizProgress = {
  cardKey: string;
  errors: number;
  solved: boolean;
};

export function resolveQuestionLocale(
  choice: string,
  answerLocale: string,
  availableLocales: readonly string[],
  cardIndex: number,
): string {
  const alternatives = availableLocales.filter(
    (locale) => locale !== answerLocale,
  );
  if (
    choice !== "random" &&
    choice !== answerLocale &&
    availableLocales.includes(choice)
  ) {
    return choice;
  }
  if (!alternatives.length) return answerLocale;
  return alternatives[Math.abs(cardIndex) % alternatives.length]!;
}

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

export function selectedStudyMapRegionCode(
  content: CardContent,
): string | null {
  for (const block of content.blocks) {
    if (block.type === "europeMap" && block.selectedCountryCode) {
      return block.selectedCountryCode;
    }
    if (block.type === "geographyMap" && block.selectedRegionCode) {
      return block.selectedRegionCode;
    }
  }
  return null;
}

export function selectedStudyCountryCode(content: CardContent): string | null {
  for (const block of content.blocks) {
    if (block.type === "europeMap" && block.selectedCountryCode) {
      return block.selectedCountryCode;
    }
    if (
      block.type === "geographyMap" &&
      block.selectedRegionCode &&
      geographyMapLevels[block.mapId] === "country"
    ) {
      return block.selectedRegionCode;
    }
  }
  return null;
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
    if (block.type === "markdown") {
      try {
        parseMarkdownClozes(block.source).forEach((cloze) => {
          ids.push(`${blockIndex}:${cloze.id}`);
        });
      } catch {
        // Persisted legacy syntax must not interrupt the complete study screen.
      }
      return;
    }
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

export function applyMapQuizSelection(
  current: MapQuizProgress,
  cardKey: string,
  targetRegionCode: string,
  selectedRegionCode: string,
): MapQuizProgress {
  const errors = current.cardKey === cardKey ? current.errors : 0;
  if (selectedRegionCode === targetRegionCode) {
    return { cardKey, errors, solved: true };
  }
  return {
    cardKey,
    errors: Math.min(3, errors + 1),
    solved: false,
  };
}

export function shouldRevealMapQuiz(
  current: MapQuizProgress,
  cardKey: string,
): boolean {
  return current.cardKey === cardKey && (current.solved || current.errors >= 3);
}

const ratingRank: Record<ReviewRating, number> = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
};

export function isRatingAllowedAfterErrors(
  rating: ReviewRating,
  errorCount: number,
): boolean {
  const disabledLevels = Math.min(3, Math.max(0, errorCount));
  return ratingRank[rating] <= 3 - disabledLevels;
}

export function errorCountAfterClozeHint(errorCount: number): number {
  return Math.max(1, Math.min(3, errorCount));
}
