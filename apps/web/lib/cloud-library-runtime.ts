"use client";

import { Capacitor } from "@capacitor/core";
import { connectCloudLibrary } from "@flashcards/sync/cloud-library-bootstrap";
import { AtomicCloudLibrary, atomicCloudRootName } from "@flashcards/sync/cloud-library-atomic";
import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import { prepareCloudLibraryWeb } from "@flashcards/direct-connect-webstack/cloud-library-web";
import { nativeCloudLibraryAccount, nativeCloudLibraryEnvironment, createNativeCloudLibraryStore } from "@flashcards/direct-connect-webstack/cloud-library-native";
import { createNativeAtomicCloudStore } from "@flashcards/direct-connect-webstack/cloud-library-atomic-native";
import { createNativeCloudLibraryBindings } from "@flashcards/direct-connect-webstack/cloud-library-storage";
import { CloudLibraryRuntime, cloudCodec, type CloudDeckSyncResult } from "@flashcards/direct-connect-webstack/cloud-library-runtime";
import { readCloudPolicy, updateCloudPolicy, cloudValues,
  type CloudLibraryPolicy } from "@flashcards/direct-connect-webstack/cloud-library-policy";
import { createLocalMediaStorage } from "@flashcards/direct-connect-webstack/media-storage";
import { createBrowserCloudLibraryBindings } from "./cloud-library-binding";
import { cloudLibrarySignInConfiguration } from "./cloud-library-sign-in";
import { localProductRepository } from "./local-product-repository";

export type CloudSyncView = {status: "idle" | "busy" | "ready" | "paused" | "error";
  account: boolean; decks: CloudDeckSyncResult[]; lastSuccess: string | null};
let view: CloudSyncView = {status: "idle", account: false, decks: [], lastSuccess: null};
const listeners = new Set<() => void>();
export const cloudSyncView = () => view;
export const subscribeCloudSync = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const publish = (update: Partial<CloudSyncView>) => {view = {...view, ...update}; listeners.forEach((fn) => fn());};
let session: Promise<Awaited<ReturnType<typeof prepareCloudLibraryWeb>>> | null = null;
let inFlight: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;

function webSession() {
  const config = cloudLibrarySignInConfiguration(process.env.NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN,
    process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT);
  if (!config) throw new Error("CloudKit configuration is missing");
  session ??= prepareCloudLibraryWeb(config).catch((error) => {session = null; throw error;});
  return session;
}
async function connection() {
  const native = Capacitor.isNativePlatform();
  const web = native ? null : await webSession();
  const account = native ? await nativeCloudLibraryAccount() : await web!.account();
  if (!account) { publish({account: false}); throw new Error("Sign in to the originally linked Apple account"); }
  publish({account: true});
  const environment = native ? await nativeCloudLibraryEnvironment() : process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT;
  if (environment !== "development" && environment !== "production") throw new Error("CloudKit environment is missing");
  const assertAccount = async () => {
    const current = native ? await nativeCloudLibraryAccount() : await web!.account();
    if (current !== account) throw new CloudLibraryError("ACCOUNT_CHANGED", "Account changed");
  };
  return {account, environment: environment as "development" | "production", assertAccount,
    bindings: native ? createNativeCloudLibraryBindings() : createBrowserCloudLibraryBindings(),
    storeForAccount: native ? createNativeCloudLibraryStore : web!.storeForAccount,
    atomicStoreForAccount: native ? createNativeAtomicCloudStore : web!.atomicStoreForAccount};
}

async function openRuntime(explicit: boolean) {
  if (!Capacitor.isNativePlatform() && !navigator.locks) throw new Error("Web Locks are required for safe multi-tab sync");
  const policy = await readCloudPolicy();
  if (!explicit && (!policy || !policy.enabled)) return null;
  const transport = await connection();
  if (policy && (policy.account !== transport.account || policy.environment !== transport.environment))
    throw new Error("The original cloud account and environment are required");
  const root = await connectCloudLibrary({...transport, randomUUID: () => crypto.randomUUID()});
  const identity = {libraryId: root.libraryId, libraryGeneration: root.libraryGeneration};
  // Permanently fence peer replication before the first private content transfer.
  await updateCloudPolicy((old) => {
    if (old && (old.account !== transport.account || old.environment !== transport.environment))
      throw new Error("Cloud account binding changed");
    return old ? {...old, enabled: true} : {account: transport.account, environment: transport.environment,
      enabled: true, blocked: false, command: null};
  });
  const atomic = transport.atomicStoreForAccount(transport.account, identity);
  const library = new AtomicCloudLibrary(atomic, identity, cloudCodec.hash);
  const defaultStore = transport.storeForAccount(transport.account);
  // A shared ready marker prevents a fresh second device from recreating an
  // externally deleted custom zone. Only explicit first initialization may create.
  const markerName = "library.zone.v2";
  let marker = await defaultStore.read(markerName);
  if (!marker) {
    try { await defaultStore.compareAndSwap(markerName, null, {...identity, phase: "pending"}); }
    catch (error) { if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error; }
    marker = await defaultStore.read(markerName);
  }
  const value = marker?.value as {libraryId?: string; libraryGeneration?: string; phase?: string} | undefined;
  if (!marker || value?.libraryId !== identity.libraryId || value.libraryGeneration !== identity.libraryGeneration ||
      !["pending", "ready"].includes(value.phase ?? "")) throw new Error("Cloud zone binding changed");
  if (value.phase === "pending") {
    await atomic.createZone();
    await library.initialize();
    try { await defaultStore.compareAndSwap(markerName, marker.changeTag, {...identity, phase: "ready"}); }
    catch (error) { if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error; }
  }
  if (!await atomic.read(atomicCloudRootName)) throw new Error("Cloud library is missing; it will not be recreated");
  const repository = await localProductRepository();
  return new CloudLibraryRuntime({ ...identity, identity, library,
    account: transport.account, environment: transport.environment, assertAccount: transport.assertAccount,
    authority: repository.cloudAuthority, media: createLocalMediaStorage(), values: cloudValues(),
    blockWrites: () => updateCloudPolicy((current) => {
      if (!current) throw new Error("Cloud binding disappeared");
      return {...current, blocked: true};
    }),
  });
}

type Action = {kind: "sync"; explicit?: boolean; resolve?: {deckId: string; revisionId: string}} |
  {kind: "restore"; deckId: string} |
  {kind: "command"; deckId: string; command: "deck" | "progress" | "remove"};
export function runCloudSync(action: Action = {kind: "sync"}): Promise<void> {
  if (inFlight) return inFlight;
  clearTimeout(retryTimer);
  const operation = async () => {
    publish({status: "busy"});
    try {
      const runtime = await openRuntime(action.kind !== "sync" || Boolean(action.explicit));
      if (!runtime) { publish({status: "paused"}); return; }
      let policy = (await readCloudPolicy())!;
      if (policy.command) await runtime.executeCommand(policy.command);
      if (policy.command) await updateCloudPolicy((current) => ({...current!, command: null, blocked: false}));
      if (action.kind === "command") {
        // Freeze local edits before the preflight upload; local removal may not
        // discard an edit made between synchronization and the removal click.
        await updateCloudPolicy((current) => ({...current!, blocked: true}));
        const before = await runtime.synchronize();
        if (before.some((deck) => deck.status === "error" || deck.status === "conflict"))
          throw new Error("Resolve synchronization errors before deletion");
        const state = await runtime.state(action.deckId);
        if (!state) throw new Error("Deck is not linked");
        // Do not leave children pointing at a deleted/removed parent.
        if (action.command !== "progress") for (const deck of before) {
          if ((await runtime.state(deck.deckId))?.base?.deck.parentDeckId === action.deckId &&
              deck.status !== "deleted" && (action.command === "deck" || !deck.removed))
            throw new Error("Remove child decks first");
        }
        const command: NonNullable<CloudLibraryPolicy["command"]> = {deckId: action.deckId,
          kind: action.command, operationId: crypto.randomUUID(), nextGeneration: crypto.randomUUID()};
        await updateCloudPolicy((current) => ({...current!, blocked: true, command}));
        await runtime.executeCommand(command);
        await updateCloudPolicy((current) => ({...current!, blocked: false, command: null}));
      }
      if (action.kind === "restore") await runtime.restoreDownload(action.deckId);
      const decks = await runtime.synchronize(action.kind === "sync" ? action.resolve : undefined);
      policy = (await readCloudPolicy())!;
      // Remote erasure also raises the barrier. Clear it only after a successful
      // pass, never while a durable local erasure command remains unresolved.
      const okay = decks.every((deck) => deck.status === "synced" || deck.status === "deleted");
      if (okay && !policy.command) await updateCloudPolicy((current) => ({...current!, blocked: false}));
      publish({decks, status: okay ? "ready" : "error", ...(okay ? {lastSuccess: new Date().toISOString()} : {})});
      window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed", {detail: {source: "cloud-sync"}}));
      window.dispatchEvent(new Event("flash-n-flip:study-badge-changed"));
      failures = okay ? 0 : failures + 1;
    } catch {
      // Never surface raw SDK objects, tokens, account IDs or learner payloads.
      publish({status: "error"});
      failures += 1;
    }
  };
  inFlight = (async () => {
    if (navigator.locks) await navigator.locks.request("flash-n-flip.cloud-runtime.v2", operation);
    else await operation();
  })()
    .finally(() => {inFlight = null; scheduleCloudSync(failures ? Math.min(300_000, 5_000 * 2 ** Math.min(failures, 6)) : 60_000);});
  return inFlight;
}
export function scheduleCloudSync(delay = 1_500) {
  clearTimeout(retryTimer);
  if (document.visibilityState === "hidden" || !navigator.onLine) return;
  retryTimer = setTimeout(() => {
    void readCloudPolicy().then((policy) => { if (policy?.enabled) return runCloudSync(); })
      .catch(() => publish({status: "error"}));
  }, delay);
}
export async function pauseCloudSync() {
  await inFlight;
  await updateCloudPolicy((policy) => {
    if (!policy) throw new Error("No cloud binding");
    return {...policy, enabled: false};
  });
  clearTimeout(retryTimer); publish({status: "paused"});
}
export async function startCloudSignIn() {
  try { await connection(); publish({status: "idle"}); }
  catch { publish({status: "error"}); }
}
