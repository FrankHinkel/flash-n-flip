"use client";

import { Capacitor } from "@capacitor/core";
import { connectCloudLibrary } from "@flashcards/sync/cloud-library-bootstrap";
import {
  AtomicCloudLibrary,
  atomicCloudRootName,
} from "@flashcards/sync/cloud-library-atomic";
import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import { prepareCloudLibraryWeb } from "@flashcards/direct-connect-webstack/cloud-library-web";
import {
  nativeCloudLibraryAccount,
  nativeCloudLibraryEnvironment,
  createNativeCloudLibraryStore,
} from "@flashcards/direct-connect-webstack/cloud-library-native";
import { createNativeAtomicCloudStore } from "@flashcards/direct-connect-webstack/cloud-library-atomic-native";
import { createNativeCloudLibraryBindings } from "@flashcards/direct-connect-webstack/cloud-library-storage";
import {
  CloudLibraryRuntime,
  cloudCodec,
  type CloudConflictResolution,
  type CloudDeckSyncResult,
  type CloudTransferProgress,
} from "@flashcards/direct-connect-webstack/cloud-library-runtime";
import {
  CloudTransferControl,
  cloudTransferProblem,
  type CloudTransferProblem,
} from "@flashcards/direct-connect-webstack/cloud-transfer-control";
import {
  readCloudPolicy,
  updateCloudPolicy,
  cloudValues,
} from "@flashcards/direct-connect-webstack/cloud-library-policy";
import { createLocalMediaStorage } from "@flashcards/direct-connect-webstack/media-storage";
import { createBrowserCloudLibraryBindings } from "./cloud-library-binding";
import { executeCloudCommandAction } from "./cloud-command-execution";
import { createCloudSyncCoalescer } from "./cloud-sync-coalescer";
import { cloudLibrarySignInConfiguration } from "./cloud-library-sign-in";
import { ensureLocalCuratedActivation } from "./local-curated-catalog";
import { localProductRepository } from "./local-product-repository";
import { cloudLibraryZoneMarkerRecordName } from "./development-cloud-reset";
import { sortCloudDeckResults, upsertCloudDeckResult } from "./cloud-deck-view";
import { recoverNativeDevelopmentCloudBinding } from "./native-development-cloud-recovery";

export type CloudSyncView = {
  status: "idle" | "busy" | "ready" | "paused" | "error";
  account: boolean;
  accountStatus: "checking" | "signed-in" | "signed-out" | "error";
  decks: CloudDeckSyncResult[];
  lastSuccess: string | null;
  progress: CloudTransferProgress | null;
  requests: number;
  problem: CloudTransferProblem | null;
  stopping: boolean;
};
let view: CloudSyncView = {
  status: "idle",
  account: false,
  accountStatus: "checking",
  decks: [],
  lastSuccess: null,
  progress: null,
  requests: 0,
  problem: null,
  stopping: false,
};
const listeners = new Set<() => void>();
export const cloudSyncView = () => view;
export const subscribeCloudSync = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const publish = (update: Partial<CloudSyncView>) => {
  view = { ...view, ...update };
  listeners.forEach((fn) => fn());
};
let session: Promise<
  Awaited<ReturnType<typeof prepareCloudLibraryWeb>>
> | null = null;
let observedSession: Awaited<ReturnType<typeof prepareCloudLibraryWeb>> | null =
  null;
let stopAccountObservation: (() => void) | null = null;
let inFlight: Promise<void> | null = null;
let active: CloudTransferControl | null = null;
let pausing: Promise<void> | null = null;

async function webSession(
  control: CloudTransferControl,
  refreshControls = false,
) {
  const config = cloudLibrarySignInConfiguration(
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN,
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT,
  );
  if (!config) throw new Error("Missing CloudKit configuration");
  session ??= prepareCloudLibraryWeb(config).catch((error) => {
    session = null;
    throw error;
  });
  const current = session;
  try {
    const resolved = await control.request(() => current);
    if (observedSession !== resolved) {
      stopAccountObservation?.();
      observedSession = resolved;
      stopAccountObservation = resolved.observeAccount(
        (account) =>
          publish({
            account: Boolean(account),
            accountStatus: account ? "signed-in" : "signed-out",
          }),
        () => publish({ account: false, accountStatus: "error" }),
      );
    }
    if (refreshControls) await control.request(() => resolved.refreshAccount());
    return resolved;
  } catch (error) {
    if (session === current) {
      stopAccountObservation?.();
      stopAccountObservation = null;
      observedSession = null;
      session = null;
    }
    throw error;
  }
}

async function connection(
  control: CloudTransferControl,
  refreshWebControls = false,
) {
  const native = Capacitor.isNativePlatform();
  const web = native ? null : await webSession(control, refreshWebControls);
  const accountLookup = () =>
    native ? nativeCloudLibraryAccount() : web!.account();
  const account = await control.request(accountLookup);
  if (!account) {
    publish({ account: false, accountStatus: "signed-out" });
    throw Object.assign(new Error("Sign in to the original Apple account"), {
      code: "AUTHENTICATION_REQUIRED",
    });
  }
  publish({ account: true, accountStatus: "signed-in" });
  const configuredEnvironment = native
    ? await control.request(() => nativeCloudLibraryEnvironment())
    : process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT;
  if (
    configuredEnvironment !== "development" &&
    configuredEnvironment !== "production"
  )
    throw new Error("Invalid CloudKit environment");
  const environment: "development" | "production" = configuredEnvironment;
  const assertAccount = async () => {
    const current = await control.request(accountLookup);
    if (current !== account)
      throw new CloudLibraryError("ACCOUNT_CHANGED", "Apple account changed");
  };
  const storeForAccount = (
    token: string,
  ): ReturnType<typeof createNativeCloudLibraryStore> => {
    const store = native
      ? createNativeCloudLibraryStore(token)
      : web!.storeForAccount(token);
    return {
      read: (...args) => control.request(() => store.read(...args)),
      compareAndSwap: (...args) =>
        control.request(() => store.compareAndSwap(...args)),
    };
  };
  const atomicStoreForAccount = (
    ...args: Parameters<typeof createNativeAtomicCloudStore>
  ): ReturnType<typeof createNativeAtomicCloudStore> => {
    const store = native
      ? createNativeAtomicCloudStore(...args)
      : web!.atomicStoreForAccount(args[0], args[1]);
    return {
      read: (...values) => control.request(() => store.read(...values)),
      atomic: (...values) => control.request(() => store.atomic(...values)),
      createZone: () => control.request(() => store.createZone()),
      deleteZone: () => control.request(() => store.deleteZone()),
    };
  };
  return {
    account,
    environment,
    assertAccount,
    bindings: native
      ? createNativeCloudLibraryBindings()
      : createBrowserCloudLibraryBindings(),
    storeForAccount,
    atomicStoreForAccount,
  };
}

async function openRuntime(explicit: boolean, control: CloudTransferControl) {
  if (!Capacitor.isNativePlatform() && !navigator.locks)
    throw new Error("Browser locks are required for cloud synchronization");
  const policy = await readCloudPolicy();
  control.check();
  if (!explicit && !policy?.enabled) return null;
  const transport = await connection(control);
  if (
    policy &&
    (policy.account !== transport.account ||
      policy.environment !== transport.environment)
  ) {
    throw new CloudLibraryError(
      "ACCOUNT_CHANGED",
      "The original Apple account and environment are required",
    );
  }
  const bootstrap = {
    ...transport,
    randomUUID: () => crypto.randomUUID(),
  };
  let root;
  try {
    root = await connectCloudLibrary(bootstrap);
  } catch (error) {
    const recovered = await recoverNativeDevelopmentCloudBinding({
      allowed:
        Capacitor.isNativePlatform() &&
        (process.env.NEXT_PUBLIC_FNF_APP_VERSION ?? "").startsWith("0."),
      cause: error,
      environment: transport.environment,
      account: transport.account,
      bindings: transport.bindings,
      defaultStore: transport.storeForAccount(transport.account),
      atomicStoreForIdentity: (identity) =>
        transport.atomicStoreForAccount(transport.account, identity),
    });
    if (!recovered) throw error;
    control.check();
    root = await connectCloudLibrary(bootstrap);
  }
  control.check();
  const identity = {
    libraryId: root.libraryId,
    libraryGeneration: root.libraryGeneration,
  };
  await updateCloudPolicy((old) => {
    control.check();
    if (
      old &&
      (old.account !== transport.account ||
        old.environment !== transport.environment)
    )
      throw new Error("Cloud account binding changed");
    return old
      ? { ...old, enabled: true }
      : {
          account: transport.account,
          environment: transport.environment,
          enabled: true,
          blocked: false,
          command: null,
        };
  });
  control.check();
  const atomic = transport.atomicStoreForAccount(transport.account, identity);
  const library = new AtomicCloudLibrary(atomic, identity, cloudCodec.hash);
  const defaultStore = transport.storeForAccount(transport.account);
  const markerName = cloudLibraryZoneMarkerRecordName;
  let marker = await defaultStore.read(markerName);
  if (!marker) {
    try {
      await defaultStore.compareAndSwap(markerName, null, {
        ...identity,
        phase: "pending",
      });
    } catch (error) {
      if (!(
        error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT"
      ))
        throw error;
    }
    marker = await defaultStore.read(markerName);
  }
  const value = marker?.value as
    | { libraryId?: string; libraryGeneration?: string; phase?: string }
    | undefined;
  if (
    !value ||
    value.libraryId !== identity.libraryId ||
    value.libraryGeneration !== identity.libraryGeneration ||
    !["pending", "ready"].includes(value.phase ?? "")
  )
    throw new Error("Invalid cloud zone marker");
  if (value.phase === "pending") {
    await atomic.createZone();
    await library.initialize();
    try {
      await defaultStore.compareAndSwap(markerName, marker!.changeTag, {
        ...identity,
        phase: "ready",
      });
    } catch (error) {
      if (!(
        error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT"
      ))
        throw error;
    }
  }
  if (!(await atomic.read(atomicCloudRootName)))
    throw new Error("Cloud root missing; automatic recreation is forbidden");
  const repository = await localProductRepository();
  control.check();
  return new CloudLibraryRuntime({
    ...identity,
    identity,
    library,
    account: transport.account,
    environment: transport.environment,
    assertAccount: transport.assertAccount,
    authority: repository.cloudAuthority,
    media: createLocalMediaStorage(),
    values: cloudValues(),
    downloadRemoteDecks: false,
    checkActive: control.check,
    onProgress: (progress) => {
      control.check();
      publish({ progress });
    },
    onDeck: (deck) => {
      control.check();
      publish({ decks: upsertCloudDeckResult(view.decks, deck) });
    },
    installCuratedDeck: async (activation) => {
      const installed = await ensureLocalCuratedActivation(
        activation.sourceTemplateKey,
      );
      if (installed.deckId !== activation.deckId)
        throw new Error("Curated activation resolved to another deck");
    },
    blockWrites: () =>
      updateCloudPolicy((current) => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, blocked: true };
      }),
  });
}

export type CloudSyncAction =
  | {
      kind: "sync";
      explicit?: boolean;
      resolve?: CloudConflictResolution | readonly CloudConflictResolution[];
    }
  | { kind: "restore"; deckId: string }
  | { kind: "restore-all"; deckIds: readonly string[] }
  | {
      kind: "command";
      deckId: string;
      command: "deck" | "progress" | "remove" | "discard-local";
    }
  | {
      kind: "command-all";
      deckIds: readonly string[];
      command: "deck" | "remove" | "discard-local";
    };

function launch(
  operation: (control: CloudTransferControl) => Promise<void>,
  propagateError = false,
): Promise<void> {
  if (pausing) return pausing;
  if (inFlight) return inFlight;
  const control = new CloudTransferControl(30_000, (requests) =>
    publish({ requests }),
  );
  active = control;
  publish({ status: "busy", progress: null, requests: 0, problem: null });
  const work = async () => {
    control.check();
    await operation(control);
    control.check();
  };
  inFlight = (async () => {
    try {
      if (navigator.locks)
        await navigator.locks.request(
          "flash-n-flip.cloud-runtime.v3",
          { signal: control.signal },
          work,
        );
      else await work();
    } catch (error) {
      if (cloudTransferProblem(error) === "account")
        publish({ account: false, accountStatus: "signed-out" });
      if (control.reason === "paused")
        publish({ status: "paused", progress: null });
      else
        publish({
          status: "error",
          problem:
            control.reason === "timeout"
              ? "timeout"
              : cloudTransferProblem(error),
        });
      if (propagateError) throw error;
    } finally {
      if (active === control) active = null;
      inFlight = null;
    }
  })();
  return inFlight;
}

export function runCloudSync(
  action: CloudSyncAction = { kind: "sync" },
): Promise<void> {
  return launch(async (control) => {
    const runtime = await openRuntime(
      action.kind !== "sync" || Boolean(action.explicit),
      control,
    );
    if (!runtime) {
      publish({ status: "paused" });
      return;
    }
    let policy = (await readCloudPolicy())!;
    let directlyDeletedDeckIds: Set<string> | null = null;
    control.check();
    if (policy.command) {
      await runtime.executeCommand(policy.command);
      control.check();
      await updateCloudPolicy((current) => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, command: null, blocked: false };
      });
    }
    if (action.kind === "command" || action.kind === "command-all") {
      await updateCloudPolicy((current) => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, blocked: true };
      });
      const requestedIds =
        action.kind === "command"
          ? [action.deckId]
          : [...new Set(action.deckIds)];
      if (!requestedIds.length) throw new Error("No decks selected");
      if (action.command === "discard-local") {
        try {
          await runtime.discardLocalOnly(requestedIds);
        } finally {
          await updateCloudPolicy((current) => {
            if (!current) throw new Error("Cloud binding disappeared");
            return { ...current, blocked: false, command: null };
          });
        }
      } else {
        const orderedIds = await executeCloudCommandAction(runtime, action, {
          check: () => control.check(),
          createId: () => crypto.randomUUID(),
          persist: (command) =>
            updateCloudPolicy((current) => {
              control.check();
              if (!current) throw new Error("Cloud binding disappeared");
              return { ...current, blocked: true, command };
            }).then(() => undefined),
          complete: () =>
            updateCloudPolicy((current) => {
              control.check();
              if (!current) throw new Error("Cloud binding disappeared");
              return { ...current, blocked: false, command: null };
            }).then(() => undefined),
        });
        if (action.command === "deck")
          directlyDeletedDeckIds = new Set(orderedIds);
      }
    }
    if (action.kind === "restore-all") {
      const deckIds = [...new Set(action.deckIds)];
      if (!deckIds.length) throw new Error("No decks selected");
      if (
        (
          await Promise.all(deckIds.map((deckId) => runtime.state(deckId)))
        ).some((state) => !state)
      )
        await runtime.synchronize();
      for (const deckId of deckIds) {
        control.check();
        await runtime.restoreDownload(deckId);
      }
    }
    if (action.kind === "restore") {
      if (!(await runtime.state(action.deckId))) await runtime.synchronize();
      control.check();
      await runtime.restoreDownload(action.deckId);
    }
    control.check();
    const decks = directlyDeletedDeckIds
      ? view.decks.filter((deck) => !directlyDeletedDeckIds!.has(deck.deckId))
      : await runtime.synchronize(
          action.kind === "sync" ? action.resolve : undefined,
        );
    control.check();
    policy = (await readCloudPolicy())!;
    const okay = decks.every(
      (deck) => deck.status === "synced" || deck.status === "deleted",
    );
    if (okay && !policy.command)
      await updateCloudPolicy((current) => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, blocked: false };
      });
    control.check();
    publish({
      decks: sortCloudDeckResults(decks),
      status: okay ? "ready" : "error",
      problem: okay
        ? null
        : (decks.find((deck) => deck.problem)?.problem ?? "unknown"),
      lastSuccess: okay ? new Date().toISOString() : view.lastSuccess,
      progress: null,
    });
    window.dispatchEvent(
      new CustomEvent("decks-changed", { detail: { source: "cloud-sync" } }),
    );
    window.dispatchEvent(new Event("study-badge-changed"));
  });
}

export async function runCloudUserAction(
  action: CloudSyncAction,
): Promise<void> {
  const resumeAutomaticSync = automaticCloudSync.suspend();
  try {
    if (inFlight || pausing) await pauseCloudSync();
    return await runCloudSync(action);
  } finally {
    resumeAutomaticSync();
  }
}

export function pauseCloudSync(): Promise<void> {
  if (pausing) return pausing;
  publish({ stopping: true });
  active?.stop();
  const previous = inFlight;
  pausing = (async () => {
    try {
      await previous;
      publish({ status: "paused", progress: null, problem: null });
    } catch (error) {
      publish({ status: "error", problem: cloudTransferProblem(error) });
    } finally {
      pausing = null;
      publish({ stopping: false });
    }
  })();
  return pausing;
}

export function startCloudSignIn(): Promise<void> {
  return launch(async (control) => {
    if (view.accountStatus !== "signed-in")
      publish({ accountStatus: "checking" });
    try {
      await connection(control, true);
      control.check();
      publish({ status: "idle", accountStatus: "signed-in" });
    } catch (error) {
      if (cloudTransferProblem(error) === "account") {
        publish({
          status: "idle",
          account: false,
          accountStatus: "signed-out",
        });
        return;
      }
      publish({ account: false, accountStatus: "error" });
      throw error;
    }
  });
}

const automaticCloudSync = createCloudSyncCoalescer((explicit) =>
  runCloudSync({ kind: "sync", explicit }),
);

export function requestAutomaticCloudSync(explicit = false): void {
  automaticCloudSync.request(explicit);
}

export async function cloudLibraryIsLinked(): Promise<boolean> {
  return Boolean(await readCloudPolicy());
}

let automationUsers = 0;
let uninstallAutomation: (() => void) | null = null;

export function installCloudSyncAutomation(): () => void {
  automationUsers += 1;
  if (!uninstallAutomation) {
    let signedIn = view.accountStatus === "signed-in";
    const accountSubscription = subscribeCloudSync(() => {
      const nextSignedIn = view.accountStatus === "signed-in";
      if (nextSignedIn && !signedIn) requestAutomaticCloudSync(true);
      signedIn = nextSignedIn;
    });
    const changed = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source === "cloud-sync") return;
      publish({
        decks: view.decks.map((deck) =>
          deck.localAvailable && deck.status === "synced"
            ? { ...deck, status: "pending" }
            : deck,
        ),
      });
      requestAutomaticCloudSync(false);
    };
    window.addEventListener("flash-n-flip:decks-changed", changed);
    void startCloudSignIn();
    uninstallAutomation = () => {
      accountSubscription();
      window.removeEventListener("flash-n-flip:decks-changed", changed);
    };
  }
  return () => {
    automationUsers = Math.max(0, automationUsers - 1);
    if (!automationUsers) {
      uninstallAutomation?.();
      uninstallAutomation = null;
    }
  };
}
