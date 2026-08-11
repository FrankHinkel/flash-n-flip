export type DeckVisibilityRow = {
  id: string;
  parentDeckId: string | null;
  hiddenAt: string | Date | null;
};

export type DeckArchiveRow = {
  id: string;
  parentDeckId: string | null;
  archivedAt: string | Date | null;
};

export type DeckMetricRow = {
  id: string;
  parentDeckId: string | null;
  cardCount: number;
  reviewedCardCount: number;
  storageBytes: number;
};

export type ProgressUnitDeckMetricRow = DeckMetricRow & {
  tags: readonly string[];
};

export type ProgressUnitMetrics = {
  total: number;
  reviewed: number;
};

export const progressUnitDeckTag = "virtual-progress-unit";

export const aggregateProgressUnitMetrics = (
  decks: readonly ProgressUnitDeckMetricRow[],
  includedDeckIds: ReadonlySet<string> = new Set(decks.map((deck) => deck.id)),
): ReadonlyMap<string, ProgressUnitMetrics> => {
  const result = new Map<string, ProgressUnitMetrics>();
  for (const deck of decks) {
    if (!includedDeckIds.has(deck.id)) continue;
    const descendants = deckDescendantIds(decks, deck.id);
    const units = decks.filter(
      (candidate) =>
        includedDeckIds.has(candidate.id) &&
        descendants.has(candidate.id) &&
        candidate.tags.includes(progressUnitDeckTag),
    );
    if (units.length === 0) continue;
    result.set(deck.id, {
      total: units.length,
      reviewed: units.filter(
        (unit) =>
          unit.cardCount > 0 && unit.reviewedCardCount >= unit.cardCount,
      ).length,
    });
  }
  return result;
};

export type AggregatedDeckMetrics = Pick<
  DeckMetricRow,
  "cardCount" | "reviewedCardCount" | "storageBytes"
>;

export const deckDescendantIds = (
  decks: readonly Pick<DeckVisibilityRow, "id" | "parentDeckId">[],
  rootDeckId: string,
): ReadonlySet<string> => {
  if (!decks.some((deck) => deck.id === rootDeckId)) return new Set();
  const selected = new Set([rootDeckId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const deck of decks) {
      if (
        deck.parentDeckId &&
        selected.has(deck.parentDeckId) &&
        !selected.has(deck.id)
      ) {
        selected.add(deck.id);
        changed = true;
      }
    }
  }
  return selected;
};

export const archivedDeckIds = (
  decks: readonly DeckArchiveRow[],
): ReadonlySet<string> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const archived = new Map<string, boolean>();

  const isArchived = (deckId: string, visiting: Set<string>): boolean => {
    const cached = archived.get(deckId);
    if (cached !== undefined) return cached;
    const deck = byId.get(deckId);
    if (!deck || visiting.has(deckId)) {
      archived.set(deckId, false);
      return false;
    }
    if (deck.archivedAt) {
      archived.set(deckId, true);
      return true;
    }
    if (!deck.parentDeckId || !byId.has(deck.parentDeckId)) {
      archived.set(deckId, false);
      return false;
    }
    const result = isArchived(deck.parentDeckId, new Set(visiting).add(deckId));
    archived.set(deckId, result);
    return result;
  };

  return new Set(
    decks
      .filter((deck) => isArchived(deck.id, new Set()))
      .map((deck) => deck.id),
  );
};

export const archiveMarkerDeckId = (
  decks: readonly DeckArchiveRow[],
  deckId: string,
): string | null => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  let current = byId.get(deckId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.archivedAt) return current.id;
    current = current.parentDeckId ? byId.get(current.parentDeckId) : undefined;
  }
  return null;
};

export const restorableDeckIds = (
  decks: readonly DeckArchiveRow[],
  rootDeckId: string,
): ReadonlySet<string> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const root = byId.get(rootDeckId);
  if (!root?.archivedAt) return new Set();
  const restored = new Set(deckDescendantIds(decks, rootDeckId));
  let parentId = root.parentDeckId;
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    if (parent.archivedAt) restored.add(parent.id);
    parentId = parent.parentDeckId;
  }
  return restored;
};

export const visibleDeckIds = (
  decks: readonly DeckVisibilityRow[],
): ReadonlySet<string> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const visibility = new Map<string, boolean>();

  const isVisible = (deckId: string, visiting: Set<string>): boolean => {
    const cached = visibility.get(deckId);
    if (cached !== undefined) return cached;
    const deck = byId.get(deckId);
    if (!deck || deck.hiddenAt || visiting.has(deckId)) {
      visibility.set(deckId, false);
      return false;
    }
    if (!deck.parentDeckId || !byId.has(deck.parentDeckId)) {
      visibility.set(deckId, true);
      return true;
    }
    const nextVisiting = new Set(visiting).add(deckId);
    const result = isVisible(deck.parentDeckId, nextVisiting);
    visibility.set(deckId, result);
    return result;
  };

  return new Set(
    decks
      .filter((deck) => isVisible(deck.id, new Set()))
      .map((deck) => deck.id),
  );
};

export const aggregateDeckMetrics = (
  decks: readonly DeckMetricRow[],
  includedDeckIds: ReadonlySet<string> = new Set(decks.map((deck) => deck.id)),
): ReadonlyMap<string, AggregatedDeckMetrics> => {
  const byId = new Map(decks.map((deck) => [deck.id, deck]));
  const children = new Map<string, string[]>();
  for (const deck of decks) {
    if (!deck.parentDeckId || !byId.has(deck.parentDeckId)) continue;
    const siblings = children.get(deck.parentDeckId) ?? [];
    siblings.push(deck.id);
    children.set(deck.parentDeckId, siblings);
  }
  const result = new Map<string, AggregatedDeckMetrics>();
  const calculate = (
    deckId: string,
    visiting: ReadonlySet<string>,
  ): AggregatedDeckMetrics => {
    const cached = result.get(deckId);
    if (cached) return cached;
    const deck = byId.get(deckId);
    if (!deck || !includedDeckIds.has(deckId) || visiting.has(deckId)) {
      return { cardCount: 0, reviewedCardCount: 0, storageBytes: 0 };
    }
    const nextVisiting = new Set(visiting).add(deckId);
    const aggregate: AggregatedDeckMetrics = {
      cardCount: deck.cardCount,
      reviewedCardCount: deck.reviewedCardCount,
      storageBytes: deck.storageBytes,
    };
    for (const childId of children.get(deckId) ?? []) {
      const child = calculate(childId, nextVisiting);
      aggregate.cardCount += child.cardCount;
      aggregate.reviewedCardCount += child.reviewedCardCount;
      aggregate.storageBytes += child.storageBytes;
    }
    result.set(deckId, aggregate);
    return aggregate;
  };
  for (const deck of decks) calculate(deck.id, new Set());
  return result;
};

export const deckProgressPercent = (
  reviewedCardCount: number,
  cardCount: number,
): number =>
  cardCount > 0
    ? Math.min(
        100,
        Math.max(0, Math.round((reviewedCardCount / cardCount) * 100)),
      )
    : 0;

export const formatByteSize = (bytes: number, locale = "en"): string => {
  const safeBytes = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = safeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const maximumFractionDigits = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value)} ${units[unitIndex]}`;
};
