import type { RichTextDocument } from "@flashcards/domain/content";

export type AnkiMediaBlock =
  | {
      type: "image";
      sourceName: string;
      alt: string;
      decorative: boolean;
    }
  | {
      type: "audio";
      sourceName: string;
      label: string;
      transcript?: string;
    };

export type AnkiImageOverlayBlock = {
  type: "imageOverlay";
  baseSourceName: string;
  overlaySourceName: string;
  alt: string;
  decorative: boolean;
};

export type AnkiContentBlock =
  | {
      type: "text";
      text: string;
      marks?: { bold?: boolean; italic?: boolean; code?: boolean };
    }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "formula"; latex: string }
  | {
      type: "richText";
      revealMode: "ALL" | "SEQUENTIAL";
      document: RichTextDocument;
    }
  | {
      type: "markdown";
      revealMode: "ALL" | "SEQUENTIAL";
      source: string;
    }
  | {
      type: "cloze";
      text: string;
      presentation: "ANKI";
      activeDeletionId: number;
      deletions: Array<{
        id: number;
        start: number;
        end: number;
        hint?: string;
      }>;
    }
  | {
      type: "importImage";
      sourceName: string;
      alt: string;
      decorative: boolean;
    }
  | {
      type: "importAudio";
      sourceName: string;
      label: string;
      transcript?: string;
    }
  | AnkiMediaBlock
  | AnkiImageOverlayBlock;

export type AnkiCardContent = { blocks: AnkiContentBlock[] };

export type ParsedAnkiCard = {
  sourceCardId?: string;
  sourceNoteId: string;
  sourceNoteTypeId?: string;
  sourceNoteTypeName?: string;
  sourceTemplateOrd?: number;
  sourceClozeOrdinal?: number;
  sourceTemplateName?: string;
  sourceOriginalTemplateOrd?: number;
  sourceOriginalTemplateName?: string;
  sourceNoteGuid?: string;
  profileRuleId?: string;
  profileOutputId?: string;
  sourceFields?: Record<string, AnkiCardContent>;
  sourceFieldText?: Record<string, string>;
  sourceFieldRaw?: Record<string, string>;
  sourceState?: {
    cardType: number;
    queue: number;
    cardFlag: number;
    noteFlag: number;
  };
  front: AnkiCardContent;
  back: AnkiCardContent;
  questionLocale?: string;
  answerLocale?: string;
  linkedToPrevious?: boolean;
  suspended?: boolean;
  tags: string[];
};

export type ParsedAnkiDeck = {
  sourceDeckId: string;
  title: string;
  path: string[];
  cards: ParsedAnkiCard[];
};

export type ParsedAnkiMedia<TData extends Uint8Array = Uint8Array> = {
  sourceName: string;
  data: TData;
  mimeType: string;
  extension: string;
  kind: "image" | "audio";
};

export type ParsedAnkiPackage<TData extends Uint8Array = Uint8Array> = {
  collectionTitle: string;
  decks: ParsedAnkiDeck[];
  media: ParsedAnkiMedia<TData>[];
  warnings: string[];
  packageVersion: "legacy" | "latest";
  noteTypes: ParsedAnkiNoteType[];
};

export type ParsedAnkiNoteType = {
  sourceNoteTypeId: string;
  name: string;
  isCloze: boolean;
  fields: string[];
  templates: Array<{
    ord: number;
    name: string;
    questionFields: string[];
    answerFields: string[];
    profileTemplate?: {
      profileId: string;
      profileVersion: number;
      outputId: string;
      frontTemplate: string;
      backTemplate: string;
    };
  }>;
};
