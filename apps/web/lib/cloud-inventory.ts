"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";

import { isCuratedCloudInventoryValue } from "./cloud-inventory-classification";

export const cloudInventorySignInButtonId = "fnf-cloud-inventory-sign-in";
export const cloudInventorySignOutButtonId = "fnf-cloud-inventory-sign-out";
export const cloudInventoryMaximumRequests = 12;

const cloudKitScriptUrl = "https://cdn.apple-cloudkit.com/ck/2/cloudkit.js";
const cloudKitContainerIdentifier = "iCloud.com.flash-n-flip";
const cloudRecordType = "FlashNFlipLibraryV1";
const cloudRootRecordName = "library.root.v3";
const atomicRootRecordName = "atomic.library.v2";
const maximumRecordsPerRequest = 200;
const maximumCatalogPages = 8;
const maximumDecks = 512;
const maximumLedgerPages = 512;
const maximumHeaderPayloads = 512;

type JsonObject = Record<string, unknown>;

export type CloudInventoryRecord = {
  recordName: string;
  value: unknown;
};

export type CloudInventoryDeck = {
  id: string;
  parentDeckId: string | null;
  title: string;
  cardCount: number;
};

export type CloudInventorySnapshot = {
  decks: CloudInventoryDeck[];
  incomplete: boolean;
  requestCount: number;
};

export type CloudInventoryAvailability = "local" | "cloud" | "both";

export type CloudInventoryMergedDeck<T> = T & {
  availability: CloudInventoryAvailability;
};

export type CloudInventoryAccountState = {
  platform: "native" | "web";
  status: "checking" | "signed-in" | "signed-out" | "unavailable" | "error";
  detail?: string;
};

type ReadRecords = (
  recordNames: readonly string[],
  zoneName?: string,
) => Promise<CloudInventoryRecord[]>;

export class CloudInventoryError extends Error {
  constructor(
    message: string,
    readonly requestCount: number,
  ) {
    super(message);
    this.name = "CloudInventoryError";
  }
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function integer(value: unknown, maximum: number): number | null {
  return Number.isInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= maximum
    ? Number(value)
    : null;
}

function stableId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function scopeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(value);
}

function header(value: unknown): {
  title?: string;
  parentDeckId?: string | null;
  cardCount?: number;
} {
  const candidate = object(object(value)?.header) ?? object(value);
  if (!candidate) return {};
  const title =
    typeof candidate.title === "string" && candidate.title.trim().length <= 512
      ? candidate.title.trim()
      : undefined;
  const parentDeckId =
    candidate.parentDeckId === null || stableId(candidate.parentDeckId)
      ? candidate.parentDeckId
      : undefined;
  const cardCount = integer(candidate.cardCount, 1_000_000) ?? undefined;
  return { title, parentDeckId, cardCount };
}

export async function readBoundedCloudInventory(
  readRecords: ReadRecords,
): Promise<CloudInventorySnapshot> {
  let requestCount = 0;
  let incomplete = false;

  const fail = (message: string): never => {
    throw new CloudInventoryError(message, requestCount);
  };
  const readMany = async (names: readonly string[], zoneName?: string) => {
    const uniqueNames = [...new Set(names)];
    const records = new Map<string, CloudInventoryRecord>();
    for (
      let offset = 0;
      offset < uniqueNames.length;
      offset += maximumRecordsPerRequest
    ) {
      if (requestCount >= cloudInventoryMaximumRequests) {
        fail("Cloud inventory request limit reached");
      }
      const batch = uniqueNames.slice(
        offset,
        offset + maximumRecordsPerRequest,
      );
      requestCount += 1;
      let result: CloudInventoryRecord[] = [];
      try {
        result = await readRecords(batch, zoneName);
      } catch (cause) {
        fail(
          cause instanceof Error
            ? cause.message
            : "Cloud inventory request failed",
        );
      }
      const requested = new Set(batch);
      for (const record of result) {
        if (
          !requested.has(record.recordName) ||
          records.has(record.recordName)
        ) {
          fail("Cloud inventory response does not match the request");
        }
        records.set(record.recordName, record);
      }
    }
    return records;
  };

  try {
    const rootRecords = await readMany([cloudRootRecordName]);
    const rootRecord = rootRecords.get(cloudRootRecordName);
    if (!rootRecord) {
      return { decks: [], incomplete: false, requestCount };
    }
    const root =
      object(rootRecord.value) ?? fail("Cloud library root is invalid");
    if (
      root.kind !== "library-root" ||
      root.protocolVersion !== 1 ||
      !scopeId(root.libraryId) ||
      !scopeId(root.libraryGeneration)
    ) {
      fail("Cloud library root is invalid");
    }
    if (root.deleted === true) {
      return { decks: [], incomplete: false, requestCount };
    }
    if (root.deleted !== false) {
      fail("Cloud library root deletion state is invalid");
    }

    const zoneName = `fnf.${root.libraryId}.${root.libraryGeneration}`;
    const atomicRecords = await readMany([atomicRootRecordName], zoneName);
    const atomic =
      object(atomicRecords.get(atomicRootRecordName)?.value) ??
      fail("Cloud catalog root is missing or invalid");
    const pageCount = integer(atomic.pageCount, maximumCatalogPages);
    if (
      atomic.kind !== "atomic-library" ||
      atomic.protocolVersion !== 2 ||
      atomic.deleted !== false ||
      pageCount === null
    ) {
      fail("Cloud catalog root is missing or invalid");
    }

    const boundedPageCount = pageCount ?? 0;
    const catalogNames = Array.from(
      { length: boundedPageCount },
      (_, index) => `catalog.${index}`,
    );
    const catalogRecords = await readMany(catalogNames, zoneName);
    const deckIds: string[] = [];
    const seenDeckIds = new Set<string>();
    for (let index = 0; index < boundedPageCount; index += 1) {
      const page =
        object(catalogRecords.get(`catalog.${index}`)?.value) ??
        fail("Cloud catalog page is missing or invalid");
      if (
        page.kind !== "catalog-page" ||
        page.protocolVersion !== 2 ||
        page.index !== index ||
        !Array.isArray(page.deckIds) ||
        page.deckIds.length > 64
      ) {
        fail("Cloud catalog page is missing or invalid");
      }
      const pageDeckIds = Array.isArray(page.deckIds) ? page.deckIds : [];
      for (const deckId of pageDeckIds) {
        if (!stableId(deckId)) {
          fail("Cloud catalog contains an invalid deck identifier");
        }
        if (seenDeckIds.has(deckId)) {
          incomplete = true;
          continue;
        }
        seenDeckIds.add(deckId);
        deckIds.push(deckId);
      }
    }
    if (deckIds.length > maximumDecks) {
      fail("Cloud catalog exceeds the deck limit");
    }

    const ledgerRecords = await readMany(
      deckIds.map((deckId) => `ledger.${deckId}`),
      zoneName,
    );
    const ledgers = new Map<string, JsonObject>();
    const ledgerPageNames: string[] = [];
    for (const deckId of deckIds) {
      const ledger = object(ledgerRecords.get(`ledger.${deckId}`)?.value);
      const control = object(ledger?.control);
      const ledgerPages = integer(ledger?.pageCount, maximumLedgerPages);
      if (
        !ledger ||
        ledger.kind !== "deck-ledger" ||
        ledger.protocolVersion !== 2 ||
        !control ||
        control.deckId !== deckId ||
        ledgerPages === null
      ) {
        incomplete = true;
        continue;
      }
      if (control.deleted === true) continue;
      if (control.deleted !== false) {
        incomplete = true;
        continue;
      }
      ledgers.set(deckId, ledger);
      for (let index = 0; index < ledgerPages; index += 1) {
        ledgerPageNames.push(`ledger.${deckId}.${index}`);
      }
    }
    if (ledgerPageNames.length > maximumLedgerPages) {
      fail("Cloud catalog exceeds the ledger page limit");
    }

    const ledgerPages = await readMany(ledgerPageNames, zoneName);
    const headerNamesByDeck = new Map<string, string[]>();
    for (const [deckId, ledger] of ledgers) {
      const count = integer(ledger.pageCount, maximumLedgerPages) ?? 0;
      const candidates: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const page = object(
          ledgerPages.get(`ledger.${deckId}.${index}`)?.value,
        );
        if (
          !page ||
          page.kind !== "ledger-page" ||
          page.protocolVersion !== 2 ||
          page.deckId !== deckId ||
          page.index !== index ||
          !Array.isArray(page.entries) ||
          page.entries.length > 64
        ) {
          incomplete = true;
          continue;
        }
        for (const rawEntry of page.entries) {
          const entry = object(rawEntry);
          if (
            !entry ||
            typeof entry.logicalName !== "string" ||
            typeof entry.physicalName !== "string" ||
            !/^payload\.[a-f0-9]{64}$/.test(entry.physicalName)
          ) {
            incomplete = true;
            continue;
          }
          if (
            entry.logicalName.startsWith("revision.") ||
            entry.logicalName === "activation.v1"
          ) {
            candidates.push(entry.physicalName);
          }
        }
      }
      headerNamesByDeck.set(deckId, candidates);
    }

    const headerNames = [...new Set([...headerNamesByDeck.values()].flat())];
    if (headerNames.length > maximumHeaderPayloads) {
      fail("Cloud catalog exceeds the header limit");
    }
    const headerRecords = await readMany(headerNames, zoneName);
    const decks: CloudInventoryDeck[] = [];
    for (const deckId of deckIds) {
      if (!ledgers.has(deckId)) continue;
      const names = headerNamesByDeck.get(deckId) ?? [];
      const values = names.flatMap((name) => {
        const found = headerRecords.get(name);
        return found ? [found.value] : [];
      });
      const curated = values.some(isCuratedCloudInventoryValue);
      if (curated) continue;
      let resolved: ReturnType<typeof header> = {};
      for (let index = names.length - 1; index >= 0; index -= 1) {
        const name = names[index];
        if (!name) continue;
        const found = headerRecords.get(name);
        if (!found) {
          incomplete = true;
          continue;
        }
        const candidate = object(found.value);
        if (candidate?.deckId !== undefined && candidate.deckId !== deckId) {
          incomplete = true;
          continue;
        }
        const candidateHeader = header(found.value);
        resolved = {
          title: resolved.title ?? candidateHeader.title,
          parentDeckId: resolved.parentDeckId ?? candidateHeader.parentDeckId,
          cardCount: resolved.cardCount ?? candidateHeader.cardCount,
        };
        if (
          resolved.title !== undefined &&
          resolved.parentDeckId !== undefined &&
          resolved.cardCount !== undefined
        ) {
          break;
        }
      }
      if (resolved.title === undefined) {
        incomplete = true;
        continue;
      }
      decks.push({
        id: deckId,
        title: resolved.title,
        parentDeckId: resolved.parentDeckId ?? null,
        cardCount: resolved.cardCount ?? 0,
      });
    }
    return { decks, incomplete, requestCount };
  } catch (cause) {
    if (cause instanceof CloudInventoryError) throw cause;
    throw new CloudInventoryError(
      cause instanceof Error ? cause.message : "Cloud inventory is invalid",
      requestCount,
    );
  }
}

export function mergeCloudInventoryDecks<
  T extends {
    id: string;
    parentDeckId: string | null;
    title: string;
    cardCount: number;
  },
>(
  localDecks: readonly T[],
  cloudDecks: readonly CloudInventoryDeck[],
): Array<CloudInventoryMergedDeck<T | CloudInventoryDeck>> {
  const cloudById = new Map(cloudDecks.map((deck) => [deck.id, deck]));
  const merged: Array<CloudInventoryMergedDeck<T | CloudInventoryDeck>> =
    localDecks.map((deck) => ({
      ...deck,
      availability: cloudById.has(deck.id) ? "both" : "local",
    }));
  const localIds = new Set(localDecks.map((deck) => deck.id));
  for (const deck of cloudDecks) {
    if (!localIds.has(deck.id)) {
      merged.push({ ...deck, availability: "cloud" });
    }
  }
  return merged;
}

type NativeInventoryPlugin = {
  accountStatus(): Promise<{ status: string }>;
  readRecords(input: { recordNames: string[]; zoneName?: string }): Promise<{
    records: Array<{ recordName: string; payload: string }>;
  }>;
};

const nativeInventory = registerPlugin<NativeInventoryPlugin>(
  "FlashNFlipCloudInventory",
);

type CloudKitResponseRecord = {
  recordName?: string;
  recordType?: string;
  fields?: { payload?: { value?: unknown } };
  serverErrorCode?: string;
};

type CloudKitResponse = {
  hasErrors?: boolean;
  errors?: Array<{ serverErrorCode?: string }>;
  records?: CloudKitResponseRecord[];
};

type CloudKitDatabase = {
  fetchRecords(
    names: string[],
    options: {
      desiredKeys: string[];
      zoneID?: { zoneName: string };
    },
  ): Promise<CloudKitResponse>;
};

type CloudKitContainer = {
  privateCloudDatabase: CloudKitDatabase;
  setUpAuth(): Promise<unknown>;
  whenUserSignsIn(): Promise<unknown>;
  whenUserSignsOut(): Promise<unknown>;
};

type CloudKitApi = {
  configure(configuration: unknown): void;
  getDefaultContainer(): CloudKitContainer;
};

declare global {
  interface Window {
    CloudKit?: CloudKitApi;
    __FLASH_N_FLIP_CLOUDKIT_CONFIGURATION__?: string;
  }
}

export interface CloudInventoryClient {
  currentAccountState(): CloudInventoryAccountState;
  subscribe(listener: (state: CloudInventoryAccountState) => void): () => void;
  refreshAccount(): Promise<void>;
  readInventory(): Promise<CloudInventorySnapshot>;
}

class InventoryClient implements CloudInventoryClient {
  private state: CloudInventoryAccountState;
  private readonly listeners = new Set<
    (state: CloudInventoryAccountState) => void
  >();

  constructor(
    platform: "native" | "web",
    private readonly refresh: () => Promise<CloudInventoryAccountState>,
    private readonly read: () => Promise<CloudInventorySnapshot>,
  ) {
    this.state = { platform, status: "checking" };
  }

  currentAccountState() {
    return this.state;
  }

  subscribe(listener: (state: CloudInventoryAccountState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setState(state: CloudInventoryAccountState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  async refreshAccount() {
    this.setState(await this.refresh());
  }

  async readInventory() {
    if (this.state.status !== "signed-in") {
      throw new CloudInventoryError("Apple iCloud account is not signed in", 0);
    }
    return this.read();
  }
}

function parsePayload(payload: unknown): unknown {
  if (typeof payload !== "string") {
    throw new Error("Cloud record payload is missing");
  }
  return JSON.parse(payload) as unknown;
}

async function loadCloudKit(): Promise<CloudKitApi> {
  if (window.CloudKit) return window.CloudKit;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${cloudKitScriptUrl}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("CloudKit JS could not be loaded")),
      { once: true },
    );
    if (!existing) {
      script.src = cloudKitScriptUrl;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.append(script);
    }
  });
  if (!window.CloudKit) throw new Error("CloudKit JS is unavailable");
  return window.CloudKit;
}

function webConfiguration() {
  const apiToken = process.env.NEXT_PUBLIC_FNF_CLOUDKIT_API_TOKEN?.trim();
  const environment = process.env.NEXT_PUBLIC_FNF_CLOUDKIT_ENVIRONMENT;
  if (
    !apiToken ||
    (environment !== "development" && environment !== "production")
  ) {
    return null;
  }
  return { apiToken, environment };
}

async function createNativeClient(): Promise<CloudInventoryClient> {
  let client: InventoryClient;
  const account = async (): Promise<CloudInventoryAccountState> => {
    try {
      const result = await nativeInventory.accountStatus();
      return {
        platform: "native",
        status: result.status === "available" ? "signed-in" : "unavailable",
        detail: result.status,
      };
    } catch {
      return { platform: "native", status: "error" };
    }
  };
  const read = async () => {
    const state = await account();
    client.setState(state);
    if (state.status !== "signed-in") {
      throw new CloudInventoryError("System iCloud account is unavailable", 0);
    }
    return readBoundedCloudInventory(async (recordNames, zoneName) => {
      const response = await nativeInventory.readRecords({
        recordNames: [...recordNames],
        ...(zoneName ? { zoneName } : {}),
      });
      return response.records.map((item) => ({
        recordName: item.recordName,
        value: parsePayload(item.payload),
      }));
    });
  };
  client = new InventoryClient("native", account, read);
  await client.refreshAccount();
  return client;
}

async function createWebClient(): Promise<CloudInventoryClient> {
  const configuration = webConfiguration();
  if (!configuration) {
    const client = new InventoryClient(
      "web",
      async () => ({
        platform: "web",
        status: "unavailable",
        detail: "configuration",
      }),
      async () => {
        throw new CloudInventoryError(
          "CloudKit web configuration is missing",
          0,
        );
      },
    );
    await client.refreshAccount();
    return client;
  }

  const CloudKit = await loadCloudKit();
  const configurationKey = JSON.stringify([
    cloudKitContainerIdentifier,
    configuration.environment,
    configuration.apiToken,
    cloudInventorySignInButtonId,
    cloudInventorySignOutButtonId,
  ]);
  if (
    window.__FLASH_N_FLIP_CLOUDKIT_CONFIGURATION__ !== undefined &&
    window.__FLASH_N_FLIP_CLOUDKIT_CONFIGURATION__ !== configurationKey
  ) {
    throw new Error("CloudKit configuration changed; reload required");
  }
  if (window.__FLASH_N_FLIP_CLOUDKIT_CONFIGURATION__ === undefined)
    CloudKit.configure({
      containers: [
        {
          containerIdentifier: cloudKitContainerIdentifier,
          environment: configuration.environment,
          apiTokenAuth: {
            apiToken: configuration.apiToken,
            persist: true,
            signInButton: {
              id: cloudInventorySignInButtonId,
              theme: "black",
            },
            signOutButton: {
              id: cloudInventorySignOutButtonId,
              theme: "black",
            },
          },
        },
      ],
    });
  window.__FLASH_N_FLIP_CLOUDKIT_CONFIGURATION__ = configurationKey;
  const container = CloudKit.getDefaultContainer();
  let signedIn = false;
  let client: InventoryClient;
  const state = (): CloudInventoryAccountState => ({
    platform: "web",
    status: signedIn ? "signed-in" : "signed-out",
  });
  const readRecords: ReadRecords = async (recordNames, zoneName) => {
    const response = await container.privateCloudDatabase.fetchRecords(
      [...recordNames],
      {
        desiredKeys: ["schemaVersion", "payload"],
        ...(zoneName ? { zoneID: { zoneName } } : {}),
      },
    );
    const errors = [
      ...(response.errors ?? []),
      ...(response.records ?? []).filter((record) => record.serverErrorCode),
    ];
    const fatal = errors.find(
      (error) => error.serverErrorCode !== "UNKNOWN_ITEM",
    );
    if (response.hasErrors && fatal) {
      throw new Error(`CloudKit ${fatal.serverErrorCode ?? "request error"}`);
    }
    return (response.records ?? [])
      .filter((record) => !record.serverErrorCode)
      .map((record) => {
        if (!record.recordName || record.recordType !== cloudRecordType) {
          throw new Error("CloudKit returned an invalid record");
        }
        return {
          recordName: record.recordName,
          value: parsePayload(record.fields?.payload?.value),
        };
      });
  };
  client = new InventoryClient(
    "web",
    async () => state(),
    () => readBoundedCloudInventory(readRecords),
  );

  const armSignIn = () => {
    void container
      .whenUserSignsIn()
      .then(() => {
        signedIn = true;
        client.setState(state());
        armSignIn();
      })
      .catch(() => undefined);
  };
  const armSignOut = () => {
    void container
      .whenUserSignsOut()
      .then(() => {
        signedIn = false;
        client.setState(state());
        armSignOut();
      })
      .catch(() => undefined);
  };
  armSignIn();
  armSignOut();
  try {
    signedIn = Boolean(await container.setUpAuth());
    client.setState(state());
  } catch {
    client.setState({ platform: "web", status: "error" });
  }
  return client;
}

let clientPromise: Promise<CloudInventoryClient> | null = null;

export function getCloudInventoryClient(): Promise<CloudInventoryClient> {
  clientPromise ??= Capacitor.isNativePlatform()
    ? createNativeClient()
    : createWebClient();
  return clientPromise;
}
