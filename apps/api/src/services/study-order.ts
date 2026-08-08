import { orderSequentialStudyScope } from "@flashcards/domain";

export type StudyQueuePriority = "DUE_REVIEW" | "NEW" | "PRACTICE";

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
  queuePriority?: StudyQueuePriority;
};

export type StudyQueueOptions = {
  shuffleSeed?: string;
  selectedDeckId?: string;
  sequentialScopeDeckIds?: readonly string[];
};

type QueueGroup<T> = {
  deckId: string;
  rootId: string;
  rootPosition: number;
  studyOrder: "SCHEDULED" | "SEQUENTIAL";
  dueAt: number;
  dueBucket: number;
  priority: number;
  items: StudyQueueCandidate<T>[];
};

const dayMilliseconds = 24 * 60 * 60 * 1000;

const queuePriorityRank = (
  priority: StudyQueuePriority | undefined,
): number => {
  if (priority === "NEW") return 1;
  if (priority === "PRACTICE") return 2;
  return 0;
};

const stableRank = (seed: string, key: string): number => {
  let hash = 2_166_136_261;
  const value = `${seed}:${key}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

const compareStable = (
  seed: string,
  leftKey: string,
  rightKey: string,
): number =>
  stableRank(seed, leftKey) - stableRank(seed, rightKey) ||
  leftKey.localeCompare(rightKey);

const buildGroups = <T>(
  candidates: StudyQueueCandidate<T>[],
): QueueGroup<T>[] => {
  const byDeck = new Map<string, StudyQueueCandidate<T>[]>();
  for (const candidate of candidates) {
    const deckCards = byDeck.get(candidate.card.deckId) ?? [];
    deckCards.push(candidate);
    byDeck.set(candidate.card.deckId, deckCards);
  }

  const groups: QueueGroup<T>[] = [];
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
    let currentGroup: StudyQueueCandidate<T>[] = [];
    for (const candidate of includedCards) {
      const previous = currentGroup.at(-1);
      if (
        !candidate.card.linkedToPrevious ||
        !previous ||
        candidate.card.position !== previous.card.position + 1
      ) {
        if (currentGroup.length) {
          groups.push(toQueueGroup(deckId, currentGroup));
        }
        currentGroup = [];
      }
      currentGroup.push(candidate);
    }
    if (currentGroup.length) {
      groups.push(toQueueGroup(deckId, currentGroup));
    }
  }
  return groups;
};

const toQueueGroup = <T>(
  deckId: string,
  items: StudyQueueCandidate<T>[],
): QueueGroup<T> => {
  const questions = items.filter((candidate) => candidate.isDueQuestion);
  const priority = Math.min(
    ...questions.map((candidate) => queuePriorityRank(candidate.queuePriority)),
  );
  const dueAt = Math.min(...questions.map((candidate) => candidate.dueAt));
  return {
    deckId,
    rootId: items[0]!.card.id,
    rootPosition: items[0]!.card.position,
    studyOrder: items[0]!.studyOrder,
    dueAt,
    dueBucket: priority === 0 ? Math.floor(dueAt / dayMilliseconds) : 0,
    priority,
    items,
  };
};

const legacyOrder = <T>(groups: QueueGroup<T>[]): QueueGroup<T>[] =>
  [...groups].sort((left, right) => {
    if (left.deckId === right.deckId && left.studyOrder === "SEQUENTIAL") {
      return left.rootPosition - right.rootPosition;
    }
    return (
      left.dueAt - right.dueAt ||
      left.deckId.localeCompare(right.deckId) ||
      left.rootPosition - right.rootPosition
    );
  });

const shuffledOrder = <T>(
  groups: QueueGroup<T>[],
  seed: string,
  selectedDeckId?: string,
  sequentialScopeDeckIds?: readonly string[],
): QueueGroup<T>[] => {
  const orderedSequentialDeckIds = sequentialScopeDeckIds?.length
    ? sequentialScopeDeckIds
    : selectedDeckId
      ? [selectedDeckId]
      : [];
  const sequentialDeckIds = new Set(orderedSequentialDeckIds);
  const selectedSequential = orderSequentialStudyScope(
    groups.filter(
      (group) =>
        sequentialDeckIds.has(group.deckId) &&
        (Boolean(sequentialScopeDeckIds?.length) ||
          group.studyOrder === "SEQUENTIAL"),
    ),
    orderedSequentialDeckIds,
    (group) => ({ deckId: group.deckId, position: group.rootPosition }),
  );
  const selectedIds = new Set(selectedSequential.map((group) => group.rootId));

  const remaining = groups.filter((group) => !selectedIds.has(group.rootId));
  const tiers = new Map<string, QueueGroup<T>[]>();
  for (const group of remaining) {
    const key = `${group.priority}:${group.dueBucket}`;
    const tier = tiers.get(key) ?? [];
    tier.push(group);
    tiers.set(key, tier);
  }

  const orderedTiers = [...tiers.entries()].sort(([leftKey], [rightKey]) => {
    const [leftPriority, leftBucket] = leftKey.split(":").map(Number);
    const [rightPriority, rightBucket] = rightKey.split(":").map(Number);
    return leftPriority! - rightPriority! || leftBucket! - rightBucket!;
  });
  const shuffled: QueueGroup<T>[] = [...selectedSequential];

  for (const [tierKey, tierGroups] of orderedTiers) {
    const byDeck = new Map<string, QueueGroup<T>[]>();
    for (const group of tierGroups) {
      const deckGroups = byDeck.get(group.deckId) ?? [];
      deckGroups.push(group);
      byDeck.set(group.deckId, deckGroups);
    }
    for (const [deckId, deckGroups] of byDeck) {
      deckGroups.sort((left, right) =>
        left.studyOrder === "SEQUENTIAL"
          ? left.rootPosition - right.rootPosition
          : compareStable(
              seed,
              `${tierKey}:${deckId}:${left.rootId}`,
              `${tierKey}:${deckId}:${right.rootId}`,
            ),
      );
    }

    let round = 0;
    while ([...byDeck.values()].some((deckGroups) => deckGroups.length)) {
      const activeDecks = [...byDeck.entries()]
        .filter(([, deckGroups]) => deckGroups.length)
        .map(([deckId]) => deckId)
        .sort((left, right) =>
          compareStable(
            seed,
            `${tierKey}:round:${round}:${left}`,
            `${tierKey}:round:${round}:${right}`,
          ),
        );
      for (const deckId of activeDecks) {
        shuffled.push(byDeck.get(deckId)!.shift()!);
      }
      round += 1;
    }
  }
  return shuffled;
};

export const buildStudyQueue = <T>(
  candidates: StudyQueueCandidate<T>[],
  options: StudyQueueOptions = {},
): StudyQueueCandidate<T>[] => {
  const groups = buildGroups(candidates);
  const orderedGroups = options.shuffleSeed
    ? shuffledOrder(
        groups,
        options.shuffleSeed,
        options.selectedDeckId,
        options.sequentialScopeDeckIds,
      )
    : legacyOrder(groups);
  return orderedGroups.flatMap((group) => group.items);
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
