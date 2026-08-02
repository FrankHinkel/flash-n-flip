import {
  developerReferenceTag,
  hasDeveloperReferenceTag,
} from "@flashcards/domain/deck-study-mode";

export { developerReferenceTag, hasDeveloperReferenceTag };

type StudyModeCard = {
  card: { deckId: string };
  studyMode?: "LEARNING" | "REFERENCE";
};

export function shouldBrowseDeveloperReferences(
  selectedDeckId: string,
  selectedDeckTags: readonly string[] | null | undefined,
  cards: readonly StudyModeCard[],
): boolean {
  return (
    hasDeveloperReferenceTag(selectedDeckTags) ||
    Boolean(
      selectedDeckId &&
      cards.length > 0 &&
      cards.every((card) => card.studyMode === "REFERENCE"),
    )
  );
}

export function filterLearningCards<T extends StudyModeCard>(
  cards: readonly T[],
  referenceBrowsing: boolean,
  referenceDeckIds: ReadonlySet<string>,
): T[] {
  if (referenceBrowsing) return [...cards];
  return cards.filter(
    (card) =>
      card.studyMode !== "REFERENCE" && !referenceDeckIds.has(card.card.deckId),
  );
}

export function shouldUsePracticeAll(
  explicitlyRequested: boolean,
  ...deckTagGroups: (readonly string[] | null | undefined)[]
) {
  return explicitlyRequested || hasDeveloperReferenceTag(...deckTagGroups);
}

export function resolveEmptyStudyQueue<T extends StudyModeCard>(
  selectedDeckId: string,
  selectedDeckTags: readonly string[] | null | undefined,
  allCards: readonly T[],
): T[] {
  return shouldBrowseDeveloperReferences(
    selectedDeckId,
    selectedDeckTags,
    allCards,
  )
    ? [...allCards]
    : [];
}
