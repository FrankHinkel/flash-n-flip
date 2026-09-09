import type {
  CloudDeckSyncResult,
  CloudLibraryRuntime,
} from "@flashcards/direct-connect-webstack/cloud-library-runtime";

export type ExecutableCloudCommand = "deck" | "progress" | "remove";

export type ExecutableCloudCommandAction =
  | {
      kind: "command";
      deckId: string;
      command: ExecutableCloudCommand | "discard-local";
    }
  | {
      kind: "command-all";
      deckIds: readonly string[];
      command: ExecutableCloudCommand | "discard-local";
    };

type Runtime = Pick<
  CloudLibraryRuntime,
  "synchronize" | "state" | "executeCommand"
>;

type PersistedCommand = Parameters<CloudLibraryRuntime["executeCommand"]>[0];

function childFirstDeckIds(
  decks: readonly CloudDeckSyncResult[],
  requestedIds: readonly string[],
): string[] {
  const requested = new Set(requestedIds);
  const byId = new Map(decks.map((deck) => [deck.deckId, deck]));
  const visiting = new Set<string>();
  const completed = new Set<string>();
  const result: string[] = [];
  const visit = (deckId: string): void => {
    if (completed.has(deckId)) return;
    if (visiting.has(deckId))
      throw new Error("Deck hierarchy contains a cycle");
    if (!byId.has(deckId))
      throw new Error("Deck list changed before the requested action");
    visiting.add(deckId);
    for (const deck of decks) {
      if (requested.has(deck.deckId) && deck.parentDeckId === deckId)
        visit(deck.deckId);
    }
    visiting.delete(deckId);
    completed.add(deckId);
    result.push(deckId);
  };
  requestedIds.forEach(visit);
  return result;
}

export async function executeCloudCommandAction(
  runtime: Runtime,
  action: ExecutableCloudCommandAction,
  callbacks: {
    check(): void;
    createId(): string;
    persist(command: PersistedCommand): Promise<void>;
    complete(): Promise<void>;
  },
): Promise<string[]> {
  if (action.command === "discard-local")
    throw new Error("Local-only deletion uses the local discard path");
  const requestedIds =
    action.kind === "command" ? [action.deckId] : [...new Set(action.deckIds)];
  if (!requestedIds.length) throw new Error("No decks selected");

  // Final deletion is addressed by the cloud catalog and must remain possible
  // even when the deck content itself is malformed or not downloaded locally.
  const before = action.command === "deck" ? [] : await runtime.synchronize();
  const orderedIds =
    action.command !== "deck" && action.kind === "command-all"
      ? childFirstDeckIds(before, requestedIds)
      : requestedIds;

  for (const deckId of orderedIds) {
    const target = before.find((deck) => deck.deckId === deckId);
    if (
      action.command !== "deck" &&
      (!target || target.status === "error" || target.status === "conflict")
    )
      throw new Error("The selected deck is not safe for this action");
    const state = await runtime.state(deckId);
    if (!state && action.command !== "deck")
      throw new Error("Deck has not synchronized");
    if (action.command === "remove") {
      for (const deck of before) {
        const child = await runtime.state(deck.deckId);
        if (
          child &&
          (child.curated?.parentDeckId ?? child.base?.deck.parentDeckId) ===
            deckId &&
          !child.deleted &&
          !child.removed
        )
          throw new Error("Remove child decks first");
      }
    }
    const command: PersistedCommand = {
      deckId,
      kind: action.command,
      operationId: callbacks.createId(),
      nextGeneration: callbacks.createId(),
    };
    await callbacks.persist(command);
    callbacks.check();
    await runtime.executeCommand(command);
    await callbacks.complete();
  }
  return orderedIds;
}
