export type DeckVisibilityRow = {
  id: string;
  parentDeckId: string | null;
  hiddenAt: string | Date | null;
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
