import type { Card, DeckDetail, FlashAndFlipApi } from "@flashcards/api-client";
import { hasCardContent, type CardContent } from "@flashcards/domain/content";

export type CardDraft = {
  editing: Card | null;
  front: CardContent;
  back: CardContent;
  frontChanged: boolean;
  backChanged: boolean;
};

export type DeckFormInput = {
  parentDeckId?: string | null;
  title: string;
  description: string;
  language: string;
  tags: string[];
};

type DeckEditorApi = Pick<
  FlashAndFlipApi,
  "createCard" | "getDeck" | "updateCard" | "updateDeck"
>;

export type CardSaveAction = "created" | "updated";

export class IncompleteCardDraftError extends Error {
  constructor() {
    super("Both card sides are required");
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

export const hasPendingCardDraft = (draft: CardDraft): boolean =>
  draft.editing
    ? draft.frontChanged || draft.backChanged
    : hasCardContent(draft.front) || hasCardContent(draft.back);

const cardInput = (draft: CardDraft) => ({
  front: draft.editing
    ? draft.frontChanged
      ? draft.front
      : draft.editing.front
    : draft.front,
  back: draft.editing
    ? draft.backChanged
      ? draft.back
      : draft.editing.back
    : draft.back,
  tags: [],
});

export const saveCardDraft = async (
  api: DeckEditorApi,
  deckId: string,
  draft: CardDraft,
): Promise<{ action: CardSaveAction; card: Card }> => {
  const input = cardInput(draft);
  if (!hasCardContent(input.front) || !hasCardContent(input.back)) {
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
