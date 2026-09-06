import {
  atomicCloudRootSchema, atomicCloudCatalogPageSchema, atomicCloudLedgerSchema,
  atomicCloudLedgerPageSchema, cloudLibraryIdentitySchema, cloudDeckControlSchema,
  type CloudLibraryIdentity, type CloudDeckControl,
} from "@flashcards/domain/cloud-library";
import { CloudLibraryError, cloudDeckControlRecordName, cloudScopeKey,
  type CloudRecordStore, type CloudVersionedRecord } from "./cloud-library.js";
import { cloudLibraryRootRecordName } from "./cloud-library-bootstrap.js";
import { canonicalLocalAuthorityPayloadBytes, type LocalAuthorityByteHasher } from "./local-authority.js";

export type CloudAtomicOperation =
  | { kind: "save"; name: string; expectedTag: string | null; value: unknown }
  | { kind: "delete"; name: string };

// Only custom zones with the atomic capability may implement this contract.
// Deletes are valid only together with a conditional guard save. They are not
// generic compare-and-delete: native CKRecord deletion has no change tag.
export interface CloudAtomicStore {
  read(name: string): Promise<CloudVersionedRecord | null>;
  atomic(operations: readonly CloudAtomicOperation[]): Promise<void>;
}
export const atomicCloudRootName = "atomic.library.v2";
const catalogName = (page: number) => `catalog.${page}`;
const ledgerName = (deckId: string) => `ledger.${deckId}`;
const pageName = (deckId: string, page: number) => `ledger.${deckId}.${page}`;
type Ledger = ReturnType<typeof atomicCloudLedgerSchema.parse>;
type Root = ReturnType<typeof atomicCloudRootSchema.parse>;
const conflict = (error: unknown) => error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT";
const stale = (): never => { throw new CloudLibraryError("STALE_GENERATION", "Cloud library, deck or progress generation changed"); };
const equal = (a: unknown, b: unknown) => {
  const left = canonicalLocalAuthorityPayloadBytes(a), right = canonicalLocalAuthorityPayloadBytes(b);
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
};
export const cloudLibraryZoneName = (candidate: CloudLibraryIdentity): string => {
  const identity = cloudLibraryIdentitySchema.parse(candidate);
  return `fnf.${identity.libraryId}.${identity.libraryGeneration}`;
};
export function validateCloudAtomicOperations(operations: readonly CloudAtomicOperation[]): void {
  if (!operations.length || operations.length > 100) throw new Error("Invalid atomic cloud batch size");
  const names = new Set<string>();
  let bytes = 0;
  for (const operation of operations) {
    if (!/^[a-zA-Z0-9.-]{1,255}$/.test(operation.name) || names.has(operation.name))
      throw new Error("Invalid or duplicate atomic cloud record name");
    names.add(operation.name);
    if (operation.kind === "save") {
      if (operation.expectedTag !== null && !operation.expectedTag) throw new Error("Empty cloud change tag");
      const size = canonicalLocalAuthorityPayloadBytes(operation.value).length;
      if (size > 200 * 1024) throw new Error("Atomic cloud record is too large");
      bytes += size;
    } else if (operation.kind !== "delete") throw new Error("Invalid atomic cloud operation");
  }
  if (bytes > 1024 * 1024) throw new Error("Atomic cloud batch is too large");
  if (operations.some((operation) => operation.kind === "delete") &&
      !operations.some((operation) => operation.kind === "save" && operation.expectedTag !== null))
    throw new Error("Cloud deletion requires a conditional guard in the same atomic batch");
}

export class AtomicCloudLibrary {
  private readonly identity: CloudLibraryIdentity;
  constructor(private readonly store: CloudAtomicStore, identity: CloudLibraryIdentity,
    private readonly hash: LocalAuthorityByteHasher) {
    this.identity = cloudLibraryIdentitySchema.parse(identity);
  }

  // Explicit first-link operation only, after reserving a durable pending
  // account/zone binding. Ordinary open/read/sync never recreates missing roots.
  async initialize(): Promise<void> {
    const existing = await this.store.read(atomicCloudRootName);
    if (existing) { await this.root(); return; }
    try {
      await this.store.atomic([{ kind: "save", name: atomicCloudRootName, expectedTag: null,
        value: atomicCloudRootSchema.parse({ ...this.identity, kind: "atomic-library", protocolVersion: 2,
          serial: 0, deleted: false, pageCount: 0, lastPageSize: 0 }) }]);
    } catch (error) { if (!conflict(error)) throw error; }
    await this.root();
  }
  private async root(): Promise<{ value: Root; changeTag: string }> {
    const record = await this.store.read(atomicCloudRootName);
    if (!record) return stale();
    const value = atomicCloudRootSchema.parse(record.value);
    if (value.deleted || value.libraryId !== this.identity.libraryId ||
        value.libraryGeneration !== this.identity.libraryGeneration) return stale();
    return { value, changeTag: record.changeTag };
  }
  private async ledger(deckId: string): Promise<{ value: Ledger; changeTag: string }> {
    const record = await this.store.read(ledgerName(deckId));
    if (!record) return stale();
    const value = atomicCloudLedgerSchema.parse(record.value);
    if (value.control.deckId !== deckId || value.control.libraryId !== this.identity.libraryId ||
        value.control.libraryGeneration !== this.identity.libraryGeneration) return stale();
    return { value, changeTag: record.changeTag };
  }
  private active(ledger: Ledger, control: CloudDeckControl): void {
    if (ledger.deletion || ledger.control.deleted || cloudScopeKey(ledger.control) !== cloudScopeKey(control)) stale();
  }
  private async page(deckId: string, index: number) {
    const record = await this.store.read(pageName(deckId, index));
    if (!record) throw new Error("Cloud ledger page is missing");
    const value = atomicCloudLedgerPageSchema.parse(record.value);
    if (value.deckId !== deckId || value.index !== index) throw new Error("Cloud ledger page identity mismatch");
    return { value, changeTag: record.changeTag };
  }
  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      try { return await operation(); } catch (error) { if (!conflict(error)) throw error; }
    }
    throw new CloudLibraryError("WRITE_CONFLICT", "Cloud is busy; retain the local operation for retry");
  }

  async registerDeck(candidate: CloudDeckControl): Promise<void> {
    const control = cloudDeckControlSchema.parse(candidate);
    if (control.deleted || control.libraryId !== this.identity.libraryId ||
        control.libraryGeneration !== this.identity.libraryGeneration) return stale();
    await this.retry(async () => {
      const root = await this.root();
      if (await this.store.read(ledgerName(control.deckId))) {
        this.active((await this.ledger(control.deckId)).value, control); return;
      }
      const append = root.value.pageCount === 0 || root.value.lastPageSize === 64;
      const index = append ? root.value.pageCount : root.value.pageCount - 1;
      const previous = append ? null : await this.store.read(catalogName(index));
      if (!append && !previous) throw new Error("Cloud catalog page is missing");
      const page = previous ? atomicCloudCatalogPageSchema.parse(previous.value)
        : { kind: "catalog-page" as const, protocolVersion: 2 as const, index, deckIds: [] as string[] };
      if (page.index !== index || page.deckIds.includes(control.deckId)) throw new Error("Cloud catalog is inconsistent");
      await this.store.atomic([
        { kind: "save", name: atomicCloudRootName, expectedTag: root.changeTag,
          value: { ...root.value, serial: root.value.serial + 1, pageCount: root.value.pageCount + Number(append),
            lastPageSize: page.deckIds.length + 1 } },
        { kind: "save", name: catalogName(index), expectedTag: previous?.changeTag ?? null,
          value: { ...page, deckIds: [...page.deckIds, control.deckId] } },
        { kind: "save", name: ledgerName(control.deckId), expectedTag: null,
          value: atomicCloudLedgerSchema.parse({ kind: "deck-ledger", protocolVersion: 2, control,
            serial: 0, pageCount: 0, lastPageSize: 0, deletion: null, lastDeletionId: null }) },
      ]);
    });
  }

  async describeDeck(deckId: string) {
    await this.root();
    return (await this.ledger(deckId)).value;
  }

  async listDecks(includeDeleted = false): Promise<CloudDeckControl[]> {
    return this.retry(async () => {
      const root = await this.root();
      const decks: CloudDeckControl[] = [];
      const seen = new Set<string>();
      for (let index = 0; index < root.value.pageCount; index++) {
        const record = await this.store.read(catalogName(index));
        if (!record) throw new Error("Cloud catalog page is missing");
        const page = atomicCloudCatalogPageSchema.parse(record.value);
        if (page.index !== index) throw new Error("Cloud catalog page identity mismatch");
        for (const deckId of page.deckIds) {
          if (seen.has(deckId)) throw new Error("Duplicate cloud catalog deck");
          seen.add(deckId);
          const ledger = await this.ledger(deckId);
          if (includeDeleted || !ledger.value.control.deleted) decks.push(ledger.value.control);
        }
      }
      if ((await this.root()).changeTag !== root.changeTag)
        throw new CloudLibraryError("WRITE_CONFLICT", "Cloud catalog changed while reading");
      return decks;
    });
  }

  deckStore(candidate: CloudDeckControl): CloudRecordStore {
    const control = cloudDeckControlSchema.parse(candidate);
    const locate = async (logicalName: string) => {
      if (!/^(activation|asset|review|progress|revision)\.[a-zA-Z0-9.-]{1,240}$/.test(logicalName))
        throw new Error("Unsupported cloud payload name");
      const category = /^(review|progress)\./.test(logicalName) ? "progress" as const : "content" as const;
      const digest = await this.hash(canonicalLocalAuthorityPayloadBytes({
        deckId: control.deckId, deckGeneration: control.deckGeneration,
        progressGeneration: category === "progress" ? control.progressGeneration : null, logicalName,
      }));
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Invalid cloud payload hash");
      return { logicalName, physicalName: `payload.${digest}`, category };
    };
    const guard = async () => {
      const root = await this.root(), ledger = await this.ledger(control.deckId);
      this.active(ledger.value, control);
      return { root, ledger };
    };
    return {
      read: async (name) => {
        const { root, ledger } = await guard();
        if (name === cloudDeckControlRecordName(control)) return { value: ledger.value.control, changeTag: ledger.changeTag };
        if (name === cloudLibraryRootRecordName) return { changeTag: root.changeTag,
          value: { ...this.identity, kind: "library-root", protocolVersion: 1, deleted: false } };
        const entry = await locate(name);
        const record = await this.store.read(entry.physicalName);
        await guard();
        return record;
      },
      compareAndSwap: async (name, expectedTag, value) => {
        const entry = await locate(name);
        await this.retry(async () => {
          const { root, ledger } = await guard();
          const current = await this.store.read(entry.physicalName);
          if ((current?.changeTag ?? null) !== expectedTag) {
            // A lost successful response is safe only for identical contents.
            if (current && equal(current.value, value)) return;
            throw new CloudLibraryError("WRITE_CONFLICT", "Cloud payload changed");
          }
          const operations: CloudAtomicOperation[] = [
            { kind: "save", name: atomicCloudRootName, expectedTag: root.changeTag,
              value: { ...root.value, serial: root.value.serial + 1 } },
            { kind: "save", name: entry.physicalName, expectedTag, value },
          ];
          let pageCount = ledger.value.pageCount, lastPageSize = ledger.value.lastPageSize;
          if (!current) {
            const append = pageCount === 0 || lastPageSize === 64;
            const index = append ? pageCount : pageCount - 1;
            const previous = append ? null : await this.page(control.deckId, index);
            const page = previous?.value ?? { kind: "ledger-page" as const, protocolVersion: 2 as const,
              deckId: control.deckId, index, entries: [] };
            operations.push({ kind: "save", name: pageName(control.deckId, index), expectedTag: previous?.changeTag ?? null,
              value: { ...page, entries: [...page.entries, entry] } });
            pageCount += Number(append); lastPageSize = page.entries.length + 1;
          }
          operations.push({ kind: "save", name: ledgerName(control.deckId), expectedTag: ledger.changeTag,
            value: { ...ledger.value, serial: ledger.value.serial + 1, pageCount, lastPageSize } });
          await this.store.atomic(operations);
        });
        await guard();
      },
    };
  }

  async listPayloadNames(control: CloudDeckControl): Promise<string[]> {
    return this.retry(async () => {
      await this.root();
      const ledger = await this.ledger(control.deckId); this.active(ledger.value, control);
      const names: string[] = [];
      for (let index = 0; index < ledger.value.pageCount; index++)
        names.push(...(await this.page(control.deckId, index)).value.entries.map((entry) => entry.logicalName));
      const after = await this.ledger(control.deckId); this.active(after.value, control);
      if (after.changeTag !== ledger.changeTag) throw new CloudLibraryError("WRITE_CONFLICT", "Cloud ledger changed while reading");
      await this.root(); return names;
    });
  }

  // Caller first durably stores this exact operation ID and next generation.
  // Retrying it after lost responses cannot reset a newly learned generation.
  async beginDeletion(control: CloudDeckControl, operationId: string, nextProgressGeneration?: string): Promise<void> {
    cloudDeckControlSchema.parse(control);
    await this.retry(async () => {
      const root = await this.root(), ledger = await this.ledger(control.deckId);
      if (ledger.value.lastDeletionId === operationId || ledger.value.deletion?.operationId === operationId) return;
      this.active(ledger.value, control);
      if (nextProgressGeneration === control.progressGeneration) throw new Error("Reset requires a fresh progress generation");
      const changed = atomicCloudLedgerSchema.parse({ ...ledger.value, serial: ledger.value.serial + 1,
        control: { ...control, ...(nextProgressGeneration ? { progressGeneration: nextProgressGeneration } : { deleted: true }) },
        deletion: { kind: nextProgressGeneration ? "progress" : "deck", operationId, page: 0 } });
      await this.store.atomic([
        { kind: "save", name: atomicCloudRootName, expectedTag: root.changeTag, value: { ...root.value, serial: root.value.serial + 1 } },
        { kind: "save", name: ledgerName(control.deckId), expectedTag: ledger.changeTag, value: changed },
      ]);
    });
  }

  // One bounded page per call. The deletion cursor and physical removals commit
  // together, so crash recovery neither skips a payload nor reports early success.
  async continueDeletion(deckId: string, operationId: string): Promise<boolean> {
    return this.retry(async () => {
      const root = await this.root(), ledger = await this.ledger(deckId);
      if (ledger.value.lastDeletionId === operationId) return true;
      const deletion = ledger.value.deletion;
      if (!deletion || deletion.operationId !== operationId) throw new Error("Cloud deletion operation changed");
      const operations: CloudAtomicOperation[] = [{ kind: "save", name: atomicCloudRootName,
        expectedTag: root.changeTag, value: { ...root.value, serial: root.value.serial + 1 } }];
      let changed = { ...ledger.value, serial: ledger.value.serial + 1 };
      const done = deletion.page >= ledger.value.pageCount;
      if (done) changed = { ...changed, deletion: null, lastDeletionId: operationId };
      else {
        const page = await this.page(deckId, deletion.page);
        const removed = page.value.entries.filter((entry) => deletion.kind === "deck" || entry.category === "progress");
        for (const entry of removed) {
          if (await this.store.read(entry.physicalName)) operations.push({ kind: "delete", name: entry.physicalName });
        }
        const retained = page.value.entries.filter((entry) => !removed.includes(entry));
        operations.push({ kind: "save", name: pageName(deckId, deletion.page), expectedTag: page.changeTag,
          value: { ...page.value, entries: retained } });
        changed = { ...changed, deletion: { ...deletion, page: deletion.page + 1 },
          lastPageSize: deletion.page === ledger.value.pageCount - 1 ? retained.length : ledger.value.lastPageSize };
      }
      operations.push({ kind: "save", name: ledgerName(deckId), expectedTag: ledger.changeTag, value: changed });
      await this.store.atomic(operations); return done;
    });
  }
}
