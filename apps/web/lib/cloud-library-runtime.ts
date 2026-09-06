"use client";

import { Capacitor } from "@capacitor/core";
import { connectCloudLibrary } from "@flashcards/sync/cloud-library-bootstrap";
import { AtomicCloudLibrary, atomicCloudRootName } from "@flashcards/sync/cloud-library-atomic";
import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import { prepareCloudLibraryWeb } from "@flashcards/direct-connect-webstack/cloud-library-web";
import { nativeCloudLibraryAccount, nativeCloudLibraryEnvironment, createNativeCloudLibraryStore } from "@flashcards/direct-connect-webstack/cloud-library-native";
import { createNativeAtomicCloudStore } from "@flashcards/direct-connect-webstack/cloud-library-atomic-native";
import { createNativeCloudLibraryBindings } from "@flashcards/direct-connect-webstack/cloud-library-storage";
import { CloudLibraryRuntime, cloudCodec, type CloudDeckSyncResult, type CloudTransferProgress } from "@flashcards/direct-connect-webstack/cloud-library-runtime";
import { CloudTransferControl, cloudTransferProblem, type CloudTransferProblem } from "@flashcards/direct-connect-webstack/cloud-transfer-control";
import { readCloudPolicy, updateCloudPolicy, cloudValues } from "@flashcards/direct-connect-webstack/cloud-library-policy";
import { createLocalMediaStorage } from "@flashcards/direct-connect-webstack/media-storage";
import { createBrowserCloudLibraryBindings } from "./cloud-library-binding";
import { cloudLibrarySignInConfiguration } from "./cloud-library-sign-in";
import { ensureLocalCuratedActivation } from "./local-curated-catalog";
import { localProductRepository } from "./local-product-repository";

export type CloudSyncView = {
  status: "idle" | "busy" | "ready" | "paused" | "error";
  account: boolean;
  decks: CloudDeckSyncResult[];
  lastSuccess: string | null;
  progress: CloudTransferProgress | null;
  requests: number;
  problem: CloudTransferProblem | null;
  stopping: boolean;
};
let view: CloudSyncView = { status: "idle", account: false, decks: [], lastSuccess: null, progress: null, requests: 0, problem: null, stopping: false };
const listeners = new Set<() => void>();
export const cloudSyncView = () => view;
export const subscribeCloudSync = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const publish = (update: Partial<CloudSyncView>) => {
  view = { ...view, ...update };
  listeners.forEach(fn => fn());
};
let session: Promise<Awaited<ReturnType<typeof prepareCloudLibraryWeb>>> | null = null;
let inFlight: Promise<void> | null = null;
let active: CloudTransferControl | null = null;
let pausing: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

async function webSession(control: CloudTransferControl) {
  const config = cloudLibrarySignInConfiguration(
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN,
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT,
  );
  if (!config) throw new Error("Missing CloudKit configuration");
  session ??= prepareCloudLibraryWeb(config).catch(error => { session = null; throw error; });
  const current = session;
  try {
    return await control.request(() => current);
  } catch (error) {
    if (session === current) session = null;
    throw error;
  }
}

async function connection(control: CloudTransferControl) {
  const native = Capacitor.isNativePlatform();
  const web = native ? null : await webSession(control);
  const accountLookup = () => native ? nativeCloudLibraryAccount() : web!.account();
  const account = await control.request(accountLookup);
  if (!account) {
    publish({ account: false });
    throw Object.assign(new Error("Sign in to the original Apple account"), {
      code: "AUTHENTICATION_REQUIRED",
    });
  }
  publish({ account: true });
  const configuredEnvironment = native
    ? await control.request(() => nativeCloudLibraryEnvironment())
    : process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT;
  if (configuredEnvironment !== "development" && configuredEnvironment !== "production") throw new Error("Invalid CloudKit environment");
  const environment: "development" | "production" = configuredEnvironment;
  const assertAccount = async () => {
    const current = await control.request(accountLookup);
    if (current !== account) throw new CloudLibraryError("ACCOUNT_CHANGED", "Apple account changed");
  };
  const storeForAccount = (token: string): ReturnType<typeof createNativeCloudLibraryStore> => {
    const store = native ? createNativeCloudLibraryStore(token) : web!.storeForAccount(token);
    return {
      read: (...args) => control.request(() => store.read(...args)),
      compareAndSwap: (...args) => control.request(() => store.compareAndSwap(...args)),
    };
  };
  const atomicStoreForAccount = (...args: Parameters<typeof createNativeAtomicCloudStore>): ReturnType<typeof createNativeAtomicCloudStore> => {
    const store = native ? createNativeAtomicCloudStore(...args) : web!.atomicStoreForAccount(args[0], args[1]);
    return {
      read: (...values) => control.request(() => store.read(...values)),
      atomic: (...values) => control.request(() => store.atomic(...values)),
      createZone: () => control.request(() => store.createZone()),
    };
  };
  return {
    account, environment, assertAccount,
    bindings: native ? createNativeCloudLibraryBindings() : createBrowserCloudLibraryBindings(),
    storeForAccount, atomicStoreForAccount,
  };
}

async function openRuntime(explicit: boolean, control: CloudTransferControl) {
  if (!Capacitor.isNativePlatform() && !navigator.locks) throw new Error("Browser locks are required for cloud synchronization");
  const policy = await readCloudPolicy();
  control.check();
  if (!explicit && !policy?.enabled) return null;
  const transport = await connection(control);
  if (policy && (policy.account !== transport.account || policy.environment !== transport.environment)) {
    throw new CloudLibraryError("ACCOUNT_CHANGED", "The original Apple account and environment are required");
  }
  const root = await connectCloudLibrary({ ...transport, randomUUID: () => crypto.randomUUID() });
  control.check();
  const identity = { libraryId: root.libraryId, libraryGeneration: root.libraryGeneration };
  await updateCloudPolicy(old => {
    control.check();
    if (old && (old.account !== transport.account || old.environment !== transport.environment)) throw new Error("Cloud account binding changed");
    return old ? { ...old, enabled: true } : {
      account: transport.account, environment: transport.environment, enabled: true, blocked: false, command: null,
    };
  });
  control.check();
  const atomic = transport.atomicStoreForAccount(transport.account, identity);
  const library = new AtomicCloudLibrary(atomic, identity, cloudCodec.hash);
  const defaultStore = transport.storeForAccount(transport.account);
  const markerName = "library.zone.v2";
  let marker = await defaultStore.read(markerName);
  if (!marker) {
    try { await defaultStore.compareAndSwap(markerName, null, { ...identity, phase: "pending" }); }
    catch (error) { if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error; }
    marker = await defaultStore.read(markerName);
  }
  const value = marker?.value as { libraryId?: string; libraryGeneration?: string; phase?: string } | undefined;
  if (!value || value.libraryId !== identity.libraryId || value.libraryGeneration !== identity.libraryGeneration || !["pending", "ready"].includes(value.phase ?? "")) throw new Error("Invalid cloud zone marker");
  if (value.phase === "pending") {
    await atomic.createZone();
    await library.initialize();
    try { await defaultStore.compareAndSwap(markerName, marker!.changeTag, { ...identity, phase: "ready" }); }
    catch (error) { if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error; }
  }
  if (!await atomic.read(atomicCloudRootName)) throw new Error("Cloud root missing; automatic recreation is forbidden");
  const repository = await localProductRepository();
  control.check();
  return new CloudLibraryRuntime({
    ...identity, identity, library, account: transport.account, environment: transport.environment,
    assertAccount: transport.assertAccount, authority: repository.cloudAuthority,
    media: createLocalMediaStorage(), values: cloudValues(), checkActive: control.check,
    onProgress: progress => { control.check(); publish({ progress }); },
    installCuratedDeck: async activation => {
      const installed = await ensureLocalCuratedActivation(activation.sourceTemplateKey);
      if (installed.deckId !== activation.deckId) throw new Error("Curated activation resolved to another deck");
    },
    blockWrites: () => updateCloudPolicy(current => {
      control.check();
      if (!current) throw new Error("Cloud binding disappeared");
      return { ...current, blocked: true };
    }),
  });
}

type Action =
  | { kind: "sync"; explicit?: boolean; resolve?: { deckId: string; revisionId: string } }
  | { kind: "restore"; deckId: string }
  | { kind: "command"; deckId: string; command: "deck" | "progress" | "remove" };

function launch(operation: (control: CloudTransferControl) => Promise<void>, reschedule: boolean): Promise<void> {
  if (pausing) return pausing;
  if (inFlight) return inFlight;
  clearTimeout(retryTimer);
  const control = new CloudTransferControl(30_000, requests => publish({ requests }));
  active = control;
  publish({ status: "busy", progress: null, requests: 0, problem: null });
  const work = async () => { control.check(); await operation(control); control.check(); };
  inFlight = (async () => {
    try {
      if (navigator.locks) await navigator.locks.request("flash-n-flip.cloud-runtime.v2", { signal: control.signal }, work);
      else await work();
    } catch (error) {
      if (control.reason === "paused") publish({ status: "paused", progress: null });
      else publish({ status: "error", problem: control.reason === "timeout" ? "timeout" : cloudTransferProblem(error) });
    } finally {
      if (active === control) active = null;
      inFlight = null;
      if (reschedule && !control.reason && !pausing && view.status === "ready") scheduleCloudSync(60_000);
    }
  })();
  return inFlight;
}

export function runCloudSync(action: Action = { kind: "sync" }): Promise<void> {
  return launch(async control => {
    const runtime = await openRuntime(action.kind !== "sync" || Boolean(action.explicit), control);
    if (!runtime) { publish({ status: "paused" }); return; }
    let policy = (await readCloudPolicy())!;
    control.check();
    if (policy.command) {
      await runtime.executeCommand(policy.command);
      control.check();
      await updateCloudPolicy(current => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, command: null, blocked: false };
      });
    }
    if (action.kind === "command") {
      await updateCloudPolicy(current => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, blocked: true };
      });
      const before = await runtime.synchronize();
      if (before.some(deck => deck.status === "error" || deck.status === "conflict")) throw new Error("Resolve synchronization errors before deletion");
      const state = await runtime.state(action.deckId);
      if (!state) throw new Error("Deck has not synchronized");
      if (action.command !== "progress") {
        for (const deck of before) {
          const child = await runtime.state(deck.deckId);
          if (child && (child.curated?.parentDeckId ?? child.base?.deck.parentDeckId) === action.deckId &&
              !child.deleted && (action.command === "deck" || !child.removed)) throw new Error("Remove child decks first");
        }
      }
      const command = { deckId: action.deckId, kind: action.command, operationId: crypto.randomUUID(), nextGeneration: crypto.randomUUID() };
      await updateCloudPolicy(current => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, blocked: true, command };
      });
      control.check();
      await runtime.executeCommand(command);
      await updateCloudPolicy(current => {
        control.check();
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, blocked: false, command: null };
      });
    }
    if (action.kind === "restore") await runtime.restoreDownload(action.deckId);
    control.check();
    const decks = await runtime.synchronize(action.kind === "sync" ? action.resolve : undefined);
    control.check();
    policy = (await readCloudPolicy())!;
    const okay = decks.every(deck => deck.status === "synced" || deck.status === "deleted");
    if (okay && !policy.command) await updateCloudPolicy(current => {
      control.check();
      if (!current) throw new Error("Cloud binding disappeared");
      return { ...current, blocked: false };
    });
    control.check();
    publish({ decks, status: okay ? "ready" : "error", problem: okay ? null : decks.find(deck => deck.problem)?.problem ?? "unknown", lastSuccess: okay ? new Date().toISOString() : view.lastSuccess, progress: null });
    window.dispatchEvent(new CustomEvent("decks-changed", { detail: { source: "cloud-sync" } }));
    window.dispatchEvent(new Event("study-badge-changed"));
  }, true);
}

export function scheduleCloudSync(delay = 1500) {
  clearTimeout(retryTimer);
  if (pausing || document.visibilityState === "hidden" || !navigator.onLine) return;
  retryTimer = setTimeout(() => {
    void readCloudPolicy().then(policy => {
      if (policy?.enabled && !pausing) return runCloudSync();
    }).catch(() => publish({ status: "error", problem: "unknown" }));
  }, delay);
}

export function pauseCloudSync(): Promise<void> {
  if (pausing) return pausing;
  clearTimeout(retryTimer);
  publish({ stopping: true });
  active?.stop();
  const previous = inFlight;
  pausing = (async () => {
    try {
      await previous;
      const policy = await readCloudPolicy();
      if (policy) await updateCloudPolicy(current => {
        if (!current) throw new Error("Cloud binding disappeared");
        return { ...current, enabled: false };
      });
      publish({ status: "paused", progress: null, problem: null });
    } catch (error) {
      publish({ status: "error", problem: cloudTransferProblem(error) });
    } finally {
      clearTimeout(retryTimer);
      pausing = null;
      publish({ stopping: false });
    }
  })();
  return pausing;
}

export function startCloudSignIn(): Promise<void> {
  return launch(async control => {
    await connection(control);
    control.check();
    publish({ status: "idle" });
  }, false);
}
