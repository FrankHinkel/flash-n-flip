import {
  cardContentPlainText,
  type CardContent,
} from "@flashcards/domain/content";

export type CardListSummary = {
  text?: string;
  hasAudio: boolean;
  hasVideo: boolean;
};

export const cardListSummary = (content: CardContent): CardListSummary => {
  const text = cardContentPlainText({
    blocks: content.blocks.filter(
      (block) => block.type !== "audio" && block.type !== "video",
    ),
  }).trim();

  return {
    text: text || undefined,
    hasAudio: content.blocks.some((block) => block.type === "audio"),
    hasVideo: content.blocks.some((block) => block.type === "video"),
  };
};
