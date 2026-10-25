"use client";
import {
  nativeEngine,
  NativeEngineReplica,
  type EngineStatus,
} from "@flashcards/direct-connect-webstack/cloud-engine-native";
import { createLocalMediaStorage } from "@flashcards/direct-connect-webstack/media-storage";
import { localDeckPayloadSchema } from "@flashcards/domain/local-app-data";
import { localProductRepository } from "./local-product-repository";
import type { CloudSyncAction, CloudSyncView } from "./cloud-library-runtime";

let replicaPromise: Promise<NativeEngineReplica> | null = null;
export const nativeReplica = () =>
  (replicaPromise ??= localProductRepository().then(
    (repository) =>
      new NativeEngineReplica(
        repository.cloudAuthority,
        createLocalMediaStorage(),
      ),
  ));
let state: EngineStatus = {
  enabled: false,
  account: false,
  progressPending: 0,
  contentPending: 0,
  mediaPending: 0,
  inboxPending: 0,
  suppressed: [],
  problem: null,
  lastSuccess: null,
};
const listeners = new Set<() => void>();
export const nativeEngineStatus = () => state;
export const subscribeNativeEngine = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
let viewPublisher: ((value: Partial<CloudSyncView>) => void) | null = null;
let resetting = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let refreshing: Promise<void> | null = null;
let refreshAgain = false;
export async function refreshNativeEngine(): Promise<void> {
  if (resetting) return;
  if (refreshing) {
    refreshAgain = true;
    return refreshing;
  }
  refreshing = (async () => {
    try {
      const replica = await nativeReplica();
      const before = await nativeEngine.status();
      // Rebuild after content removal/restoration too, even with an empty inbox.
      await replica.applyInbox();
      state = await nativeEngine.status();
      const records = replica.records();
      const deleted = new Set(
        records.filter((r) => r.kind === "DECK" && r.deleted).map((r) => r.id),
      );
      viewPublisher?.({
        account: state.account,
        accountStatus: state.account ? "signed-in" : "signed-out",
        status: state.problem
          ? "error"
          : !state.enabled
            ? "paused"
            : state.progressPending +
                state.contentPending +
                state.mediaPending +
                state.inboxPending
              ? "busy"
              : "ready",
        lastSuccess: state.lastSuccess,
        problem: state.problem ? "unavailable" : null,
        progress: null,
        requests: 0,
        decks: records
          .filter(
            (r) =>
              r.kind === "DECK" &&
              !r.deleted &&
              !r.ancestors.some((id) => deleted.has(id)),
          )
          .map((r) => {
            const deck = localDeckPayloadSchema.parse(r.body);
            return {
              deckId: r.id,
              title: deck.title,
              parentDeckId: deck.parentDeckId,
              cardCount: records.filter(
                (c) => c.kind === "CARD" && c.deckId === r.id && !c.deleted,
              ).length,
              curated: !!deck.sourceTemplateKey,
              localAvailable: !r.ancestors.some((id) =>
                state.suppressed.includes(id),
              ),
              removed: false,
              revisions: [],
              status: state.contentPending ? "pending" : "synced",
            };
          }),
      });
      if (before.inboxPending) {
        window.dispatchEvent(
          new CustomEvent("decks-changed", {
            detail: { source: "cloud-sync" },
          }),
        );
        window.dispatchEvent(new Event("study-badge-changed"));
      }
      listeners.forEach((fn) => fn());
    } finally {
      refreshing = null;
    }
    if (refreshAgain) {
      refreshAgain = false;
      scheduleRefresh();
    }
  })();
  return refreshing;
}
function scheduleRefresh() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void refreshNativeEngine().catch(failed);
  }, 50);
}
function failed(cause: unknown) {
  if (resetting || (cause as { code?: string })?.code === "FNF_SYNC_CANCELLED")
    return;
  state = {
    ...state,
    problem: cause instanceof Error ? cause.message : String(cause),
  };
  viewPublisher?.({ status: "error", problem: "unavailable" });
  listeners.forEach((fn) => fn());
}
export async function configureNativeEngine(enabled?: boolean) {
  if (resetting) return;
  state = await nativeEngine.configure(
    enabled === undefined ? {} : { enabled },
  );
  if (state.enabled) {
    const replica = await nativeReplica();
    await replica.flushReviews();
    void replica
      .flushContent()
      .then(() => nativeEngine.synchronize())
      .then(refreshNativeEngine)
      .catch(failed);
  }
  await refreshNativeEngine();
}
export async function runNativeEngineAction(
  action: CloudSyncAction,
): Promise<void> {
  if (action.kind === "sync" && action.explicit && !state.enabled)
    await configureNativeEngine(true);
  if (!state.enabled && action.kind === "sync") return;
  const replica = await nativeReplica();
  await replica.flushReviews();
  if (action.kind === "command" || action.kind === "command-all") {
    const ids =
      action.kind === "command" ? [action.deckId] : [...action.deckIds];
    if (action.command === "progress")
      return void (await replica.resetProgress(ids));
    await replica.flushContent();
    await replica.remove(ids, action.command === "deck");
  } else if (action.kind === "restore" || action.kind === "restore-all") {
    await replica.restore(
      action.kind === "restore" ? [action.deckId] : [...action.deckIds],
    );
  } else {
    await replica.flushContent();
    await nativeEngine.synchronize();
  }
  await refreshNativeEngine();
  window.dispatchEvent(
    new CustomEvent("decks-changed", { detail: { source: "cloud-sync" } }),
  );
  window.dispatchEvent(new Event("study-badge-changed"));
}
export async function resetLegacyNativeTestData(): Promise<string[]> {
  const replica = await nativeReplica();
  resetting = true;
  if (timer) clearTimeout(timer);
  timer = null;
  await refreshing?.catch(() => undefined);
  let zones: string[];
  try {
    zones = await replica.resetLegacy();
  } finally {
    resetting = false;
    await refreshNativeEngine();
  }
  window.dispatchEvent(
    new CustomEvent("decks-changed", { detail: { source: "cloud-sync" } }),
  );
  return zones;
}
export function installNativeEngineAutomation(
  publish: (value: Partial<CloudSyncView>) => void,
): () => void {
  viewPublisher = publish;
  const changed = (event: Event) => {
    if (
      resetting ||
      (event as CustomEvent<{ source?: string }>).detail?.source ===
        "cloud-sync" ||
      !state.enabled
    )
      return;
    void nativeReplica()
      .then(async (replica) => {
        await replica.flushReviews();
        await replica.flushContent();
        scheduleRefresh();
      })
      .catch(failed);
  };
  window.addEventListener("flash-n-flip:decks-changed", changed);
  const listener = nativeEngine.addListener("changed", scheduleRefresh);
  void configureNativeEngine().catch(failed);
  return () => {
    viewPublisher = null;
    window.removeEventListener("flash-n-flip:decks-changed", changed);
    void listener.then((handle) => handle.remove());
    if (timer) clearTimeout(timer);
    timer = null;
  };
}

export async function resetNativeProgress(deckIds: string[]): Promise<number> {
  const count = await (await nativeReplica()).resetProgress(deckIds);
  await refreshNativeEngine();
  return count;
}
