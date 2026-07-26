import type { Card, DeckDetail, FlashAndFlipApi } from "@flashcards/api-client";
import type { CardContent } from "@flashcards/domain/content";

export type CardDraft = {
  editing: Card | null;
  front: string;
  back: string;
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

const textContent = (text: string): CardContent => ({
  blocks: [{ type: "text", text }],
});

export const mergeEditedText = (
  original: CardContent,
  text: string,
  changed: boolean,
): CardContent => {
  if (!changed) return original;
  const preserved = original.blocks.filter((block) => block.type !== "text");
  const trimmed = text.trim();
  return {
    blocks: trimmed
      ? [{ type: "text", text: trimmed }, ...preserved]
      : preserved,
  };
};

export const hasPendingCardDraft = (draft: CardDraft): boolean =>
  draft.editing
    ? draft.frontChanged || draft.backChanged
    : Boolean(draft.front.trim() || draft.back.trim());

const cardInput = (draft: CardDraft) => ({
  front: draft.editing
    ? mergeEditedText(draft.editing.front, draft.front, draft.frontChanged)
    : textContent(draft.front.trim()),
  back: draft.editing
    ? mergeEditedText(draft.editing.back, draft.back, draft.backChanged)
    : textContent(draft.back.trim()),
  tags: [],
});

const hasCardContent = (content: CardContent): boolean =>
  content.blocks.some(
    (block) => block.type !== "text" || Boolean(block.text.trim()),
  );

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
