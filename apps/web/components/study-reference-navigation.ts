export type ReferenceNavigationDirection = "previous" | "next";

export function shouldShowReferenceContent(
  isDeveloperReference: boolean,
  answerHasContent: boolean,
): boolean {
  return isDeveloperReference && answerHasContent;
}

export function adjacentReferenceIndex(
  currentIndex: number,
  cardCount: number,
  direction: ReferenceNavigationDirection,
): number {
  const lastIndex = Math.max(0, cardCount - 1);
  const offset = direction === "previous" ? -1 : 1;
  return Math.min(lastIndex, Math.max(0, currentIndex + offset));
}
