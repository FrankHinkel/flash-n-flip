import type { Card, DeckDetail } from "@flashcards/api-client";
import { createId } from "@flashcards/domain";
import { isValidCardContentPair } from "@flashcards/domain/content";

import {
  cardDraftInput,
  IncompleteCardDraftError,
  type CardDraft,
} from "./deck-editor-save";

const editableCardSnapshot = (card: Card) => ({
  front: card.front,
  back: card.back,
  kind: card.kind ?? "QUESTION",
  linkedToPrevious: card.linkedToPrevious ?? false,
  questionLocale: card.questionLocale ?? null,
  answerLocale: card.answerLocale ?? null,
});

export const stageCardDraft = (
  deck: DeckDetail,
  draft: CardDraft,
  now = new Date().toISOString(),
): { action: "created" | "updated"; deck: DeckDetail; card: Card } => {
  const input = cardDraftInput(draft);
  if (!isValidCardContentPair(input.kind, input.front, input.back)) {
    throw new IncompleteCardDraftError();
  }
  if (draft.editing) {
    const card: Card = { ...draft.editing, ...input, updatedAt: now };
    return {
      action: "updated",
      card,
      deck: {
        ...deck,
        cards: deck.cards.map((item) => (item.id === card.id ? card : item)),
      },
    };
  }

  const card: Card = {
    id: createId(),
    deckId: deck.id,
    noteId: createId(),
    front: input.front,
    back: input.back,
    translations: {},
    kind: input.kind,
    position: Math.max(0, ...deck.cards.map((item) => item.position ?? 0)) + 1,
    linkedToPrevious: deck.cards.length > 0 && Boolean(input.linkedToPrevious),
    version: 1,
    suspended: false,
    createdAt: now,
    updatedAt: now,
  };
  return {
    action: "created",
    card,
    deck: { ...deck, cards: [...deck.cards, card] },
  };
};

export const stageCardDeletion = (
  deck: DeckDetail,
  card: Card,
): DeckDetail => ({
  ...deck,
  cards: deck.cards.filter((item) => item.noteId !== card.noteId),
});

export type DeckEditorCardCommit = {
  createdCards: Array<{
    id: string;
    noteId: string;
    front: Card["front"];
    back: Card["back"];
    kind: NonNullable<Card["kind"]>;
    linkedToPrevious: boolean;
  }>;
  updatedCards: Array<{
    id: string;
    front: Card["front"];
    back: Card["back"];
    kind: NonNullable<Card["kind"]>;
    linkedToPrevious: boolean;
    version: number;
  }>;
  deletedCards: Array<{ id: string; version: number }>;
  cardIds: string[];
  changed: boolean;
};

export const buildDeckEditorCardCommit = (
  baselineCards: readonly Card[],
  draftCards: readonly Card[],
): DeckEditorCardCommit => {
  const baseline = new Map(baselineCards.map((card) => [card.id, card]));
  const draft = new Map(draftCards.map((card) => [card.id, card]));
  const createdCards = draftCards
    .filter((card) => !baseline.has(card.id))
    .map((card) => ({
      id: card.id,
      noteId: card.noteId,
      front: card.front,
      back: card.back,
      kind: card.kind ?? "QUESTION",
      linkedToPrevious: card.linkedToPrevious ?? false,
    }));
  const updatedCards = draftCards
    .filter((card) => {
      const original = baseline.get(card.id);
      return (
        original &&
        JSON.stringify(editableCardSnapshot(original)) !==
          JSON.stringify(editableCardSnapshot(card))
      );
    })
    .map((card) => ({
      id: card.id,
      front: card.front,
      back: card.back,
      kind: card.kind ?? "QUESTION",
      linkedToPrevious: card.linkedToPrevious ?? false,
      version: baseline.get(card.id)!.version,
    }));
  const deletedCards = baselineCards
    .filter((card) => !draft.has(card.id))
    .map(({ id, version }) => ({ id, version }));
  const cardIds = draftCards.map(({ id }) => id);
  const orderChanged =
    baselineCards.length !== draftCards.length ||
    baselineCards.some((card, index) => card.id !== cardIds[index]);

  return {
    createdCards,
    updatedCards,
    deletedCards,
    cardIds,
    changed:
      orderChanged ||
      createdCards.length > 0 ||
      updatedCards.length > 0 ||
      deletedCards.length > 0,
  };
};
