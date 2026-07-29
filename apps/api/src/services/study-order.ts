export type StudyQueueCandidate<T> = {
  card: T & {
    id: string;
    deckId: string;
    kind: "QUESTION" | "EXPLANATION";
    position: number;
    linkedToPrevious: boolean;
  };
  studyOrder: "SCHEDULED" | "SEQUENTIAL";
  dueAt: number;
  isDueQuestion: boolean;
};

export const buildStudyQueue = <T>(
  candidates: StudyQueueCandidate<T>[],
): StudyQueueCandidate<T>[] => {
  const byDeck = new Map<string, StudyQueueCandidate<T>[]>();
  for (const candidate of candidates) {
    const deckCards = byDeck.get(candidate.card.deckId) ?? [];
    deckCards.push(candidate);
    byDeck.set(candidate.card.deckId, deckCards);
  }

  const queue: Array<
    StudyQueueCandidate<T> & { groupKey: string; groupDueAt: number }
  > = [];
  for (const [deckId, unsorted] of byDeck) {
    const deckCards = [...unsorted].sort(
      (left, right) => left.card.position - right.card.position,
    );
    const included = new Set(
      deckCards
        .filter((candidate) => candidate.isDueQuestion)
        .map((candidate) => candidate.card.id),
    );

    for (let index = 1; index < deckCards.length; index += 1) {
      const current = deckCards[index]!;
      const previous = deckCards[index - 1]!;
      if (
        included.has(current.card.id) &&
        current.card.linkedToPrevious &&
        (previous.card.kind === "EXPLANATION" || previous.isDueQuestion)
      ) {
        included.add(previous.card.id);
      }
    }
    for (let index = deckCards.length - 1; index > 0; index -= 1) {
      const current = deckCards[index]!;
      const previous = deckCards[index - 1]!;
      if (
        included.has(current.card.id) &&
        current.card.linkedToPrevious &&
        previous.card.kind === "EXPLANATION"
      ) {
        included.add(previous.card.id);
      }
    }

    const includedCards = deckCards.filter((candidate) =>
      included.has(candidate.card.id),
    );
    const groupRootById = new Map<string, string>();
    let currentRoot = "";
    for (const candidate of includedCards) {
      const previous = includedCards.find(
        (item) => item.card.position === candidate.card.position - 1,
      );
      if (
        !candidate.card.linkedToPrevious ||
        !previous ||
        !included.has(previous.card.id)
      ) {
        currentRoot = candidate.card.id;
      }
      groupRootById.set(candidate.card.id, currentRoot || candidate.card.id);
    }
    const dueByGroup = new Map<string, number>();
    for (const candidate of includedCards) {
      if (!candidate.isDueQuestion) continue;
      const root = groupRootById.get(candidate.card.id)!;
      dueByGroup.set(
        root,
        Math.min(
          dueByGroup.get(root) ?? Number.POSITIVE_INFINITY,
          candidate.dueAt,
        ),
      );
    }
    for (const candidate of includedCards) {
      const root = groupRootById.get(candidate.card.id)!;
      queue.push({
        ...candidate,
        groupKey: `${deckId}:${root}`,
        groupDueAt: dueByGroup.get(root) ?? candidate.dueAt,
      });
    }
  }

  return queue
    .sort((left, right) => {
      if (left.groupKey === right.groupKey) {
        return left.card.position - right.card.position;
      }
      if (
        left.card.deckId === right.card.deckId &&
        left.studyOrder === "SEQUENTIAL"
      ) {
        return left.card.position - right.card.position;
      }
      return (
        left.groupDueAt - right.groupDueAt ||
        left.card.deckId.localeCompare(right.card.deckId) ||
        left.card.position - right.card.position
      );
    })
    .map(
      ({ groupKey: _groupKey, groupDueAt: _groupDueAt, ...candidate }) =>
        candidate,
    );
};

export const limitStudyQueue = <T>(
  queue: StudyQueueCandidate<T>[],
  limit: number,
): StudyQueueCandidate<T>[] => {
  const limited: StudyQueueCandidate<T>[] = [];
  let index = 0;

  while (index < queue.length) {
    const groupStart = index;
    index += 1;
    while (
      index < queue.length &&
      queue[index]!.card.deckId === queue[index - 1]!.card.deckId &&
      queue[index]!.card.position === queue[index - 1]!.card.position + 1 &&
      queue[index]!.card.linkedToPrevious
    ) {
      index += 1;
    }

    const group = queue.slice(groupStart, index);
    if (limited.length > 0 && limited.length + group.length > limit) {
      break;
    }
    limited.push(...group);
    if (limited.length >= limit) {
      break;
    }
  }

  return limited;
};
