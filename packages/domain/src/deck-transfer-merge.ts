export type TransferDeckIdentity = {
  id: string;
  parentDeckId?: string | null;
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

/**
 * Plans a collection transfer parent-first and matches equal names only among
 * siblings. This keeps repeated folder names in separate collection branches
 * and makes every imported child point at the receiver's resolved parent id.
 */
export function planDeckHierarchyTransferMerge(
  localDecks: readonly TransferDeckIdentity[],
  incomingDecks: readonly TransferDeckIdentity[],
): DeckTransferMergeDecision[] {
  const incomingIds = new Set(incomingDecks.map((deck) => deck.id));
  const pending = new Map(incomingDecks.map((deck) => [deck.id, deck]));
  const targetIdByIncomingId = new Map<string, string>();
  const decisions: DeckTransferMergeDecision[] = [];
  const localById = new Map(localDecks.map((deck) => [deck.id, deck]));

  const decide = (
    incoming: TransferDeckIdentity,
    targetParentDeckId: string | null,
  ): DeckTransferMergeDecision => {
    const sameId = localById.get(incoming.id);
    const siblings = localDecks.filter(
      (deck) => (deck.parentDeckId ?? null) === targetParentDeckId,
    );
    const sameTitle = siblings.filter(
      (deck) =>
        normalizedDeckTitle(deck.title) === normalizedDeckTitle(incoming.title),
    );
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
  };

  while (pending.size) {
    let progressed = false;
    for (const [incomingId, incoming] of [...pending]) {
      const parentId = incoming.parentDeckId ?? null;
      if (parentId && incomingIds.has(parentId) && pending.has(parentId)) {
        continue;
      }
      if (
        parentId &&
        incomingIds.has(parentId) &&
        !targetIdByIncomingId.has(parentId)
      ) {
        decisions.push({
          incomingDeckId: incomingId,
          targetDeckId: null,
          action: "IGNORE",
          reason: "AMBIGUOUS",
        });
        pending.delete(incomingId);
        progressed = true;
        continue;
      }
      const targetParentDeckId = parentId
        ? (targetIdByIncomingId.get(parentId) ?? parentId)
        : null;
      const decision = decide(incoming, targetParentDeckId);
      decisions.push(decision);
      if (decision.targetDeckId) {
        targetIdByIncomingId.set(incomingId, decision.targetDeckId);
      }
      pending.delete(incomingId);
      progressed = true;
    }
    if (progressed) continue;
    for (const incomingId of pending.keys()) {
      decisions.push({
        incomingDeckId: incomingId,
        targetDeckId: null,
        action: "IGNORE",
        reason: "AMBIGUOUS",
      });
    }
    break;
  }
  return decisions;
}
