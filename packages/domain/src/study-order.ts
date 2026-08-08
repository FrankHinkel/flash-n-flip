export type StudySequencePosition = {
  deckId: string;
  position: number;
};

export const orderSequentialStudyScope = <T>(
  items: readonly T[],
  orderedDeckIds: readonly string[],
  positionOf: (item: T) => StudySequencePosition,
): T[] => {
  const deckRank = new Map(
    orderedDeckIds.map((deckId, index) => [deckId, index] as const),
  );
  return [...items].sort((left, right) => {
    const leftPosition = positionOf(left);
    const rightPosition = positionOf(right);
    return (
      (deckRank.get(leftPosition.deckId) ?? Number.MAX_SAFE_INTEGER) -
        (deckRank.get(rightPosition.deckId) ?? Number.MAX_SAFE_INTEGER) ||
      leftPosition.position - rightPosition.position ||
      leftPosition.deckId.localeCompare(rightPosition.deckId)
    );
  });
};
