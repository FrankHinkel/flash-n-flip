export type TransferDeckIdentity = {
  id: string;
  title: string;
  updatedAt: string;
  cardCount?: number;
};

export type DeckTransferMergeDecision = {
  incomingDeckId: string;
  targetDeckId: string | null;
  action: "INSERT" | "UPDATE" | "IGNORE";
  reason: "NEW" | "NEWER" | "SAME_OR_OLDER" | "AMBIGUOUS" | "ID_COLLISION";
};

const normalizedDeckTitle = (title: string): string =>
  title.normalize("NFKC").trim().replaceAll(/\s+/g, " ").toLocaleLowerCase();

const timestamp = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Deck timestamp is invalid");
  return parsed;
};

export function planDeckTransferMerge(
  localDecks: readonly TransferDeckIdentity[],
  incomingDecks: readonly TransferDeckIdentity[],
): DeckTransferMergeDecision[] {
  const localById = new Map(localDecks.map((deck) => [deck.id, deck]));
  const localByTitle = new Map<string, TransferDeckIdentity[]>();
  for (const deck of localDecks) {
    const key = normalizedDeckTitle(deck.title);
    localByTitle.set(key, [...(localByTitle.get(key) ?? []), deck]);
  }

  return incomingDecks.map((incoming) => {
    const sameId = localById.get(incoming.id);
    const sameTitle =
      localByTitle.get(normalizedDeckTitle(incoming.title)) ?? [];
    const exact = sameTitle.find((candidate) => candidate.id === incoming.id);
    const local = exact ?? (sameTitle.length === 1 ? sameTitle[0] : null);
    if (!local && sameTitle.length > 1) {
      return {
        incomingDeckId: incoming.id,
        targetDeckId: null,
        action: "IGNORE",
        reason: "AMBIGUOUS",
      };
    }
    if (!local && sameId) {
      return {
        incomingDeckId: incoming.id,
        targetDeckId: null,
        action: "IGNORE",
        reason: "ID_COLLISION",
      };
    }
    if (!local) {
      return {
        incomingDeckId: incoming.id,
        targetDeckId: incoming.id,
        action: "INSERT",
        reason: "NEW",
      };
    }
    if (
      timestamp(incoming.updatedAt) > timestamp(local.updatedAt) ||
      ((local.cardCount ?? 0) === 0 && (incoming.cardCount ?? 0) > 0)
    ) {
      return {
        incomingDeckId: incoming.id,
        targetDeckId: local.id,
        action: "UPDATE",
        reason: "NEWER",
      };
    }
    return {
      incomingDeckId: incoming.id,
      targetDeckId: local.id,
      action: "IGNORE",
      reason: "SAME_OR_OLDER",
    };
  });
}
