import type {
  LocalImportCard,
  LocalImportDeck,
} from "../lib/local-file-import";
import type { AnkiCardContent } from "@flashcards/domain/anki-import-types";

export type AnkiImportLivePreviewRecord = {
  sourceNoteId: string;
  sourceNoteTypeName?: string;
  sourceFieldText: Record<string, string>;
  tags: string[];
  cards: LocalImportCard[];
};

export type AnkiImportPreviewMediaReference =
  | {
      kind: "image";
      sourceName: string;
      label: string;
      decorative?: boolean;
    }
  | {
      kind: "audio";
      sourceName: string;
      label: string;
    }
  | {
      kind: "imageOverlay";
      baseSourceName: string;
      overlaySourceName: string;
      label: string;
      decorative: boolean;
    };

export const ankiImportPreviewMediaReferences = (
  content: AnkiCardContent,
): AnkiImportPreviewMediaReference[] =>
  content.blocks.flatMap((block): AnkiImportPreviewMediaReference[] => {
    if (block.type === "image" || block.type === "importImage") {
      return [
        {
          kind: "image",
          sourceName: block.sourceName,
          label: block.alt || block.sourceName,
          decorative: block.decorative,
        },
      ];
    }
    if (block.type === "audio" || block.type === "importAudio") {
      return [
        {
          kind: "audio",
          sourceName: block.sourceName,
          label: block.label || block.sourceName,
        },
      ];
    }
    if (block.type === "imageOverlay") {
      return [
        {
          kind: "imageOverlay",
          baseSourceName: block.baseSourceName,
          overlaySourceName: block.overlaySourceName,
          label: block.alt || block.baseSourceName,
          decorative: block.decorative,
        },
      ];
    }
    return [];
  });

export const toggledAnkiImportPreviewDeck = (
  currentDeckId: string | null,
  requestedDeckId: string,
): string | null =>
  currentDeckId === requestedDeckId ? null : requestedDeckId;

export const clampedAnkiImportPreviewRecordIndex = (
  requestedIndex: number,
  recordCount: number,
): number => {
  if (!Number.isFinite(requestedIndex) || recordCount <= 0) return 0;
  return Math.min(Math.max(Math.trunc(requestedIndex), 0), recordCount - 1);
};

export const ankiImportLivePreviewRecords = (
  deck: Pick<LocalImportDeck, "cards"> | undefined,
): AnkiImportLivePreviewRecord[] => {
  const records = new Map<string, AnkiImportLivePreviewRecord>();

  for (const card of deck?.cards ?? []) {
    const existing = records.get(card.sourceNoteId);
    if (existing) {
      existing.cards.push(card);
      for (const tag of card.tags) {
        if (!existing.tags.includes(tag)) existing.tags.push(tag);
      }
      continue;
    }

    records.set(card.sourceNoteId, {
      sourceNoteId: card.sourceNoteId,
      sourceNoteTypeName: card.sourceNoteTypeName,
      sourceFieldText: card.sourceFieldText ?? {},
      tags: [...card.tags],
      cards: [card],
    });
  }

  return [...records.values()];
};
