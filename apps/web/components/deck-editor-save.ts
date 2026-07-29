import type { Card, DeckDetail, FlashAndFlipApi } from "@flashcards/api-client";
import type { CardKind, DeckStudyOrder } from "@flashcards/domain";
import {
  hasCardContent,
  isValidCardContentPair,
  validateCardContent,
  type CardContent,
} from "@flashcards/domain/content";

export type CardDraft = {
  editing: Card | null;
  front: CardContent;
  back: CardContent;
  frontChanged: boolean;
  backChanged: boolean;
  linkedToPrevious?: boolean;
  linkedToPreviousChanged?: boolean;
};

export type DeckFormInput = {
  parentDeckId?: string | null;
  title: string;
  description: string;
  language: string;
  studyOrder?: DeckStudyOrder;
  tags: string[];
};

type DeckEditorApi = Pick<
  FlashAndFlipApi,
  "createCard" | "getDeck" | "updateCard" | "updateDeck"
>;

export type CardSaveAction = "created" | "updated";

export class IncompleteCardDraftError extends Error {
  constructor() {
    super(
      "A question needs an answer or cloze; an explanation needs content on the back",
    );
    this.name = "IncompleteCardDraftError";
  }
}

export class CardSaveAfterDeckError extends Error {
  constructor(
    readonly savedDeck: DeckDetail,
    readonly cause: unknown,
  ) {
    super("The deck was saved, but its pending card was not");
    this.name = "CardSaveAfterDeckError";
  }
}

export const markdownEditorKey = (
  side: "front" | "back",
  cardId: string | null,
  locale: string,
  generation: number,
): string => `${side}-${cardId ?? "new"}-${locale}-${generation}`;

export const defaultLinkForNewCard = (cards: readonly Card[]): boolean =>
  cards.at(-1)?.kind === "EXPLANATION";

export const hasPendingCardDraft = (draft: CardDraft): boolean =>
  Boolean(
    draft.editing
      ? draft.frontChanged || draft.backChanged || draft.linkedToPreviousChanged
      : hasCardContent(draft.front) || hasCardContent(draft.back),
  );

const cardInput = (draft: CardDraft) => {
  const front = draft.editing
    ? draft.frontChanged
      ? draft.front
      : draft.editing.front
    : draft.front;
  const back = draft.editing
    ? draft.backChanged
      ? draft.back
      : draft.editing.back
    : draft.back;
  const kind: CardKind = hasCardContent(front) ? "QUESTION" : "EXPLANATION";
  validateCardContent(front);
  validateCardContent(back);
  return {
    front,
    back,
    kind,
    linkedToPrevious:
      draft.linkedToPrevious ?? draft.editing?.linkedToPrevious ?? false,
    tags: [] as string[],
  };
};

export const saveCardDraft = async (
  api: DeckEditorApi,
  deckId: string,
  draft: CardDraft,
): Promise<{ action: CardSaveAction; card: Card }> => {
  const input = cardInput(draft);
  if (!isValidCardContentPair(input.kind, input.front, input.back)) {
    throw new IncompleteCardDraftError();
  }
  if (draft.editing) {
    const card = await api.updateCard(deckId, draft.editing.id, {
      ...input,
      version: draft.editing.version,
    });
    return { action: "updated", card };
  }
  return {
    action: "created",
    card: await api.createCard(deckId, input),
  };
};

export const saveDeckWithPendingCard = async (
  api: DeckEditorApi,
  deck: DeckDetail,
  input: DeckFormInput,
  draft: CardDraft,
): Promise<{ deck: DeckDetail; cardAction: CardSaveAction | null }> => {
  const updated = await api.updateDeck(deck.id, {
    ...input,
    version: deck.version,
  });
  const savedDeck = { ...deck, ...updated };

  if (!hasPendingCardDraft(draft)) {
    return { deck: savedDeck, cardAction: null };
  }

  try {
    const cardResult = await saveCardDraft(api, deck.id, draft);
    return {
      deck:
        cardResult.action === "updated"
          ? {
              ...savedDeck,
              cards: savedDeck.cards.map((card) =>
                card.id === cardResult.card.id ? cardResult.card : card,
              ),
            }
          : await api.getDeck(deck.id),
      cardAction: cardResult.action,
    };
  } catch (cause) {
    throw new CardSaveAfterDeckError(savedDeck, cause);
  }
};
