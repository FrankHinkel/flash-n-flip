import type { Card } from "@flashcards/api-client";

export const cardOrderKeyboardDirection = (
  key: string,
  altKey: boolean,
): -1 | 1 | undefined => {
  if (!altKey) return undefined;
  if (key === "ArrowUp") return -1;
  if (key === "ArrowDown") return 1;
  return undefined;
};

const linkedGroups = (cards: readonly Card[]): Card[][] => {
  const groups: Card[][] = [];
  for (const card of cards) {
    if (!groups.length || !card.linkedToPrevious) {
      groups.push([card]);
    } else {
      groups.at(-1)!.push(card);
    }
  }
  return groups;
};

export const moveLinkedCardGroup = (
  cards: readonly Card[],
  cardId: string,
  direction: -1 | 1,
): Card[] => {
  const groups = linkedGroups(cards);
  const sourceIndex = groups.findIndex((group) =>
    group.some((card) => card.id === cardId),
  );
  const targetIndex = sourceIndex + direction;
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= groups.length) {
    return [...cards];
  }
  [groups[sourceIndex], groups[targetIndex]] = [
    groups[targetIndex]!,
    groups[sourceIndex]!,
  ];
  return groups.flat();
};

export const dropLinkedCardGroup = (
  cards: readonly Card[],
  sourceCardId: string,
  targetCardId: string,
): Card[] => {
  const groups = linkedGroups(cards);
  const sourceIndex = groups.findIndex((group) =>
    group.some((card) => card.id === sourceCardId),
  );
  const targetIndex = groups.findIndex((group) =>
    group.some((card) => card.id === targetCardId),
  );
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return [...cards];
  }

  const [source] = groups.splice(sourceIndex, 1);
  groups.splice(targetIndex, 0, source!);
  return groups.flat();
};

export const isCardOrderChanged = (
  before: readonly Card[],
  after: readonly Card[],
): boolean =>
  before.length === after.length &&
  before.some((card, index) => card.id !== after[index]?.id);
