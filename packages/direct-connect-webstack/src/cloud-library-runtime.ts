import {
  cloudAssetManifestSchema, cloudCuratedDeckActivationSchema, cloudDeckControlSchema, cloudDeckRevisionSchema, cloudReviewEventSchema,
  type CloudAssetManifest, type CloudDeckControl, type CloudDeckRevision,
  type CloudCuratedDeckActivation, type CloudLibraryIdentity, type CloudReviewEvent,
} from "@flashcards/domain/cloud-library";
import { localCardPayloadSchema, localDeckPayloadSchema, localMediaReferencePayloadSchema,
  localReviewPayloadSchema } from "@flashcards/domain/local-app-data";
import type { LocalMutationInput } from "@flashcards/domain/local-authority";
import { emptyCardState } from "@flashcards/scheduler";
import { AtomicCloudLibrary } from "@flashcards/sync/cloud-library-atomic";
import { cloudDeckRevisionHeads, CloudLibraryError, publishCloudReview,
  type CloudRecordStore } from "@flashcards/sync/cloud-library";
import { canonicalLocalAuthorityPayloadBytes, maximumLocalMutationBatchSize,
  type LocalAuthorityRepository } from "@flashcards/sync/local-authority";
import { cloudCardContent, CloudContentConflict, parseCloudDeckContent, planCloudDeckProjection,
  type CloudDeckContent } from "@flashcards/sync/cloud-library-projection";
import { cloudAssetChunkBytes, stageCloudAsset, uploadCloudAsset, verifyAssembledCloudAsset,
  type CloudAssetCodec } from "@flashcards/sync/cloud-library-assets";
import { createCloudAssetStaging, type CloudDurableKeyValue } from "./cloud-library-storage";
import type { LocalMediaStorage } from "./media-storage";
import { cloudTransferProblem, type CloudTransferProblem } from "./cloud-transfer-control";

export const cloudCodec: CloudAssetCodec = {
  async hash(bytes) {
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  },
  encode(bytes) { let text = ""; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); },
  decode(text) { return Uint8Array.from(atob(text), (char) => char.charCodeAt(0)); },
};
const same = (a: unknown, b: unknown) => {
  const left = canonicalLocalAuthorityPayloadBytes(a), right = canonicalLocalAuthorityPayloadBytes(b);
  return left.length === right.length && left.every((byte, i) => byte === right[i]);
};
const maxAssetBytes = 128 * 1024 * 1024;
const maxContentBytes = 32 * 1024 * 1024;
export type CloudDeckSyncState = {
  completedCommands?: string[];
  curated?: CloudCuratedDeckActivation;
  control: CloudDeckControl; base: CloudDeckContent | null; revisionId: string | null;
  removed: boolean; deleted: boolean;
  pending: { revision: CloudDeckRevision; media: MediaAsset[]; content: CloudDeckContent } | null;
};
type MediaAsset = { mediaId: string; mimeType: string; manifest: CloudAssetManifest };
type ContentPackage = { format: "flash-n-flip.cloud-content.v2"; content: CloudDeckContent; media: MediaAsset[] };
type Snapshot = Awaited<ReturnType<LocalAuthorityRepository["exportAll"]>>;
export type CloudDeckSyncResult = { deckId: string; title: string; removed: boolean;
  status: "synced" | "conflict" | "error" | "deleted"; revisions: string[]; problem?: CloudTransferProblem };
export type CloudTransferProgress = {
  stage: "catalog" | "activate" | "prepare" | "upload" | "download" | "reviews" | "apply" | "delete";
  current: number; total: number; completedBytes: number; totalBytes: number; deckTitle?: string;
};
export type CloudRuntimeDependencies = {
  identity: CloudLibraryIdentity; account: string; environment: "development" | "production";
  library: AtomicCloudLibrary; authority: LocalAuthorityRepository;
  media: LocalMediaStorage; values: CloudDurableKeyValue;
  assertAccount(): Promise<void>;
  checkActive?(): void;
  onProgress?(progress: CloudTransferProgress): void;
  installCuratedDeck?(activation: CloudCuratedDeckActivation): Promise<void>;
  // The application persists a write barrier before beginning/replaying erasure.
  blockWrites(): Promise<void>;
  now?(): Date;
};

function mergeEntity<T>(id: string, base: T | null, local: T | null, remote: T | null): T | null {
  if (same(local, remote) || same(local, base)) return remote;
  if (same(remote, base)) return local;
  throw new CloudContentConflict(id);
}
export function mergeCloudContents(base: CloudDeckContent | null, local: CloudDeckContent | null,
  remote: CloudDeckContent): CloudDeckContent {
  if (!local) return remote;
  const mergeList = <T>(before: readonly T[], here: readonly T[], there: readonly T[], id: (v: T) => string): T[] => {
    const b = new Map(before.map((v) => [id(v), v])), l = new Map(here.map((v) => [id(v), v])),
      r = new Map(there.map((v) => [id(v), v]));
    return [...new Set([...b.keys(), ...l.keys(), ...r.keys()])].sort().flatMap((key) => {
      const result = mergeEntity(key, b.get(key) ?? null, l.get(key) ?? null, r.get(key) ?? null);
      return result === null ? [] : [result];
    });
  };
  return parseCloudDeckContent({ deckId: remote.deckId,
    deck: mergeEntity(remote.deckId, base?.deck ?? null, local.deck, remote.deck)!,
    cards: mergeList(base?.cards ?? [], local.cards, remote.cards, (v) => v.cardId),
    media: mergeList(base?.media ?? [], local.media, remote.media, (v) => v.mediaId) });
}

export function cloudContentFromSnapshot(snapshot: Snapshot, deckId: string): CloudDeckContent | null {
  const live = snapshot.payload.entities.filter((entity) => entity.winningMutation.operation === "UPSERT")
    .map((entity) => entity.winningMutation);
  const deck = live.find((m) => m.entityId === deckId && m.entityType === "DECK");
  if (!deck) return null;
  return parseCloudDeckContent({ deckId, deck: localDeckPayloadSchema.parse(deck.payload),
    cards: live.filter((m) => m.entityType === "CARD").flatMap((m) => {
      const card = localCardPayloadSchema.parse(m.payload);
      return card.deckId === deckId ? [{cardId: m.entityId, content: cloudCardContent(card)}] : [];
    }),
    media: live.filter((m) => m.entityType === "MEDIA_REFERENCE").flatMap((m) => {
      const reference = localMediaReferencePayloadSchema.parse(m.payload);
      return reference.deckId === deckId ? [{mediaId: m.entityId, reference}] : [];
    }),
  });
}
function reviewsFromSnapshot(snapshot: Snapshot, control: CloudDeckControl): CloudReviewEvent[] {
  const { deleted: _deleted, ...scope } = control;
  return snapshot.payload.entities.filter((e) => e.winningMutation.entityType === "REVIEW").flatMap((e) => {
    const review = localReviewPayloadSchema.parse(e.winningMutation.payload);
    return review.deckId === control.deckId ? [cloudReviewEventSchema.parse({...scope, review})] : [];
  });
}
function referencedMedia(content: CloudDeckContent): Set<string> {
  const ids = new Set(content.media.map((m) => m.mediaId));
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if ((key === "mediaId" || key.endsWith("MediaId")) && typeof item === "string") ids.add(item);
      else visit(item);
    }
  };
  visit(content.cards);
  if (content.deck.visual?.kind === "IMAGE") ids.add(content.deck.visual.value);
  return ids;
}

function parentFirst<T>(items: readonly T[], id: (item: T) => string,
  parent: (item: T) => string | null | undefined): T[] {
  const byId = new Map(items.map((item) => [id(item), item]));
  const completed = new Set<string>(), visiting = new Set<string>(), result: T[] = [];
  const visit = (item: T): void => {
    const itemId = id(item);
    if (completed.has(itemId)) return;
    if (visiting.has(itemId)) throw new Error("Deck hierarchy contains a cycle");
    visiting.add(itemId);
    const parentId = parent(item);
    const parentItem = parentId ? byId.get(parentId) : undefined;
    if (parentItem) visit(parentItem);
    visiting.delete(itemId); completed.add(itemId); result.push(item);
  };
  items.forEach(visit);
  return result;
}

export class CloudLibraryRuntime {
  private deckTitle: string | undefined;
  constructor(private readonly input: CloudRuntimeDependencies) {}
  private progress(stage: CloudTransferProgress["stage"], current = 0, total = 0,
    completedBytes = 0, totalBytes = 0) {
    this.input.checkActive?.();
    this.input.onProgress?.({stage, current, total, completedBytes, totalBytes, deckTitle: this.deckTitle});
  }
  private clock() { return { now: (this.input.now?.() ?? new Date()).toISOString(), maximumFutureSkewMs: 300_000 }; }
  private key(deckId: string) { return JSON.stringify(["deck-runtime-v2", this.input.environment,
    this.input.account, this.input.identity.libraryId, this.input.identity.libraryGeneration, deckId]); }
  async state(deckId: string): Promise<CloudDeckSyncState | null> {
    const raw = await this.input.values.read(this.key(deckId));
    if (raw === null) return null;
    const state = JSON.parse(raw) as CloudDeckSyncState;
    const control = cloudDeckControlSchema.parse(state.control);
    if (control.deckId !== deckId || control.libraryId !== this.input.identity.libraryId ||
        control.libraryGeneration !== this.input.identity.libraryGeneration) throw new Error("Local cloud scope changed");
    if (state.base) parseCloudDeckContent(state.base);
    if (state.pending) cloudDeckRevisionSchema.parse(state.pending.revision);
    if (state.curated) cloudCuratedDeckActivationSchema.parse(state.curated);
    return state;
  }
  private async save(state: CloudDeckSyncState) {
    await this.input.values.update(this.key(state.control.deckId), () => JSON.stringify(state));
  }
  private staging(manifest: CloudAssetManifest) {
    return createCloudAssetStaging({ ...this.input, manifest, values: this.input.values });
  }
  private async stageLocal(bytes: Uint8Array): Promise<CloudAssetManifest> {
    this.progress("prepare", 0, 1, 0, bytes.length);
    if (!bytes.length || bytes.length > maxAssetBytes) throw new Error("Cloud asset exceeds the 128 MiB transfer limit");
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += cloudAssetChunkBytes) {
      this.input.checkActive?.();
      const chunk = bytes.slice(offset, offset + cloudAssetChunkBytes);
      chunks.push({index: chunks.length, byteSize: chunk.length, sha256: await cloudCodec.hash(chunk)});
      this.progress("prepare", 0, 1, Math.min(offset + chunk.length, bytes.length), bytes.length);
    }
    const manifest = cloudAssetManifestSchema.parse({sha256: await cloudCodec.hash(bytes), byteSize: bytes.length, chunks});
    const staging = this.staging(manifest);
    for (const chunk of chunks) await staging.writeChunk(chunk.index,
      bytes.slice(chunk.index * cloudAssetChunkBytes, chunk.index * cloudAssetChunkBytes + chunk.byteSize));
    return manifest;
  }
  private async upload(store: CloudRecordStore, manifest: CloudAssetManifest) {
    this.progress("upload", 0, manifest.chunks.length);
    const staging = this.staging(manifest);
    await uploadCloudAsset({store, identity: this.input.identity, codec: cloudCodec,
      onProgress: (done, total, doneBytes, totalBytes) => this.progress("upload", done, total, doneBytes, totalBytes), source: {manifest,
      readChunk: async (index) => {
        const bytes = await staging.readChunk(index);
        if (!bytes) throw new Error("Durable upload source missing; preserve pending publication");
        return bytes;
      }} });
  }
  private async download(store: CloudRecordStore, manifest: CloudAssetManifest, limit = maxAssetBytes) {
    this.progress("download", 0, manifest.chunks.length);
    if (manifest.byteSize > limit) throw new Error("Cloud download exceeds the device transfer limit");
    const staging = this.staging(manifest);
    await stageCloudAsset({store, identity: this.input.identity, manifest, codec: cloudCodec, staging,
      onProgress: (done, total, doneBytes, totalBytes) => this.progress("download", done, total, doneBytes, totalBytes)});
    const bytes = new Uint8Array(manifest.byteSize);
    for (const chunk of manifest.chunks) {
      const part = await staging.readChunk(chunk.index);
      if (!part) throw new Error("Staged download is incomplete");
      bytes.set(part, chunk.index * cloudAssetChunkBytes);
    }
    await verifyAssembledCloudAsset(bytes, manifest, cloudCodec);
    return bytes;
  }
  private async contentPackage(store: CloudRecordStore, revision: CloudDeckRevision): Promise<ContentPackage> {
    const value = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(
      await this.download(store, revision.content, maxContentBytes))) as ContentPackage;
    if (value.format !== "flash-n-flip.cloud-content.v2" || !Array.isArray(value.media) || value.media.length > 99_999)
      throw new Error("Invalid cloud content package");
    value.content = parseCloudDeckContent(value.content);
    if (value.content.deckId !== revision.deckId) throw new Error("Cloud content belongs to another deck");
    const ids = new Set<string>();
    for (const asset of value.media) {
      if (!/^[0-9a-f-]{36}$/i.test(asset.mediaId) || ids.has(asset.mediaId) ||
          typeof asset.mimeType !== "string" || asset.mimeType.length > 255) throw new Error("Invalid cloud media descriptor");
      ids.add(asset.mediaId);
      cloudAssetManifestSchema.parse(asset.manifest);
    }
    for (const id of referencedMedia(value.content)) if (!ids.has(id)) throw new Error("Cloud package omits referenced media");
    for (const {mediaId, reference} of value.content.media) {
      const asset = value.media.find((m) => m.mediaId === mediaId)!;
      if (asset.manifest.sha256 !== reference.sha256 || asset.manifest.byteSize !== reference.byteSize ||
          asset.mimeType !== reference.mimeType) throw new Error("Cloud media reference mismatch");
    }
    return value;
  }
  private async installMedia(store: CloudRecordStore, content: ContentPackage) {
    for (const asset of content.media) {
      const previous = await this.input.media.get(asset.mediaId);
      if (previous?.sha256 === asset.manifest.sha256 && previous.bytes.length === asset.manifest.byteSize &&
          await cloudCodec.hash(previous.bytes) === asset.manifest.sha256) continue;
      // Never overwrite bytes still referenced by concurrent local content.
      if (previous && previous.sha256 !== asset.manifest.sha256) throw new CloudContentConflict(asset.mediaId);
      const bytes = await this.download(store, asset.manifest);
      await this.input.media.put({mediaId: asset.mediaId, mimeType: asset.mimeType, sha256: asset.manifest.sha256, bytes});
    }
  }
  private activation(control: CloudDeckControl, content: CloudDeckContent | null): CloudCuratedDeckActivation | null {
    if (!content?.deck.sourceTemplateKey || !content.deck.sourceContentSha256 || !content.deck.sourcePublishedAt) return null;
    return cloudCuratedDeckActivationSchema.parse({
      ...this.input.identity,
      format: "flash-n-flip.curated-activation.v1",
      protocolVersion: 1,
      deckId: control.deckId,
      deckGeneration: control.deckGeneration,
      parentDeckId: content.deck.parentDeckId,
      sourceTemplateKey: content.deck.sourceTemplateKey,
    });
  }
  private parseActivation(value: unknown, control: CloudDeckControl): CloudCuratedDeckActivation {
    const activation = cloudCuratedDeckActivationSchema.parse(value);
    if (activation.libraryId !== control.libraryId ||
        activation.libraryGeneration !== control.libraryGeneration ||
        activation.deckId !== control.deckId || activation.deckGeneration !== control.deckGeneration) {
      throw new Error("Curated activation scope mismatch");
    }
    return activation;
  }
  private async publishActivation(store: CloudRecordStore, activation: CloudCuratedDeckActivation) {
    const previous = await store.read("activation.v1");
    if (previous && !same(previous.value, activation)) throw new CloudContentConflict(activation.deckId);
    if (!previous) {
      try { await store.compareAndSwap("activation.v1", null, activation); }
      catch (error) {
        if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error;
      }
    }
    const confirmed = await store.read("activation.v1");
    if (!confirmed || !same(confirmed.value, activation)) throw new CloudContentConflict(activation.deckId);
  }
  private async acknowledge(snapshot: Snapshot, control: CloudDeckControl, store: CloudRecordStore,
    receiptName: string) {
    const deckIds = new Set(snapshot.payload.entities.filter((entity) => {
      const mutation = entity.winningMutation;
      return mutation.entityId === control.deckId || (mutation.payload && typeof mutation.payload === "object" &&
        "deckId" in mutation.payload && mutation.payload.deckId === control.deckId);
    }).map((entity) => entity.winningMutation.entityId));
    if (!await store.read(receiptName)) throw new Error("Cloud receipt disappeared");
    await this.input.assertAccount();
    await this.input.authority.acknowledgeOutbox(snapshot.payload.mutationJournal.filter((mutation) =>
      deckIds.has(mutation.entityId) && ["DECK", "CARD", "MEDIA_REFERENCE", "REVIEW"].includes(mutation.entityType))
      .map((mutation) => mutation.mutationId));
  }
  private async publish(state: CloudDeckSyncState, content: CloudDeckContent, parents: string[]) {
    const store = this.input.library.deckStore(state.control);
    if (!state.pending) {
      const media: MediaAsset[] = [];
      for (const mediaId of [...referencedMedia(content)].sort()) {
        const bytes = await this.input.media.get(mediaId);
        if (!bytes || await cloudCodec.hash(bytes.bytes) !== bytes.sha256) throw new Error("Local media missing or corrupt");
        media.push({mediaId, mimeType: bytes.mimeType, manifest: await this.stageLocal(bytes.bytes)});
      }
      const bytes = canonicalLocalAuthorityPayloadBytes({format: "flash-n-flip.cloud-content.v2", content, media});
      if (bytes.length > maxContentBytes) throw new Error("Cloud deck content exceeds 32 MiB");
      const revision = cloudDeckRevisionSchema.parse({ ...this.input.identity, protocolVersion: 1,
        deckId: state.control.deckId, deckGeneration: state.control.deckGeneration,
        revisionId: crypto.randomUUID(), parentRevisionIds: parents, content: await this.stageLocal(bytes) });
      state.pending = { revision, content, media };
      await this.save(state); // Stable revision ID and all upload bytes survive restart.
    }
    const pending = state.pending;
    for (const asset of pending.media) await this.upload(store, asset.manifest);
    await this.upload(store, pending.revision.content);
    const name = `revision.${pending.revision.revisionId}`;
    const previous = await store.read(name);
    if (previous && !same(previous.value, pending.revision)) throw new Error("Immutable revision collision");
    if (!previous) await store.compareAndSwap(name, null, pending.revision);
    const confirmed = await store.read(name);
    if (!confirmed || !same(confirmed.value, pending.revision)) throw new Error("Revision publication not confirmed");
    await this.input.assertAccount();
    state.base = pending.content;
    state.revisionId = pending.revision.revisionId;
    state.pending = null;
    await this.save(state);
  }
  private async project(snapshot: Snapshot, control: CloudDeckControl, content: CloudDeckContent,
    remoteReviews: CloudReviewEvent[]) {
    this.progress("apply", 0, 1);
    const local = cloudContentFromSnapshot(snapshot, control.deckId);
    const receipts = [];
    for (const {mediaId, reference} of content.media) {
      const media = await this.input.media.get(mediaId);
      if (!media || await cloudCodec.hash(media.bytes) !== reference.sha256) throw new Error("Installed media is unverified");
      receipts.push({mediaId, sha256: media.sha256, byteSize: media.bytes.length});
    }
    const mutations = planCloudDeckProjection({control, base: local, remote: content,
      entities: snapshot.payload.entities, localReviews: reviewsFromSnapshot(snapshot, control), remoteReviews,
      verifiedMedia: receipts, clock: this.clock(), allowContentDeletions: true});
    this.input.checkActive?.();
    if (mutations.length) await this.input.authority.commitLocalMutations(mutations, {
      maximumBatchSize: maximumLocalMutationBatchSize, expectedReplicaWatermarks: snapshot.payload.replicaWatermarks });
    this.progress("apply", 1, 1);
  }

  async synchronize(resolve?: {deckId: string; revisionId: string | "local"}): Promise<CloudDeckSyncResult[]> {
    this.progress("catalog");
    await this.input.assertAccount();
    const catalog = await this.input.library.listDecks(true);
    const initial = await this.input.authority.exportAll();
    const localDecks = initial.payload.entities.filter((entity) =>
      entity.winningMutation.entityType === "DECK" && entity.winningMutation.operation === "UPSERT");
    const localContent = new Map(localDecks.map((entity) => [entity.winningMutation.entityId,
      cloudContentFromSnapshot(initial, entity.winningMutation.entityId)!]));
    const registrationOrder = parentFirst(localDecks, (entity) => entity.winningMutation.entityId,
      (entity) => localDeckPayloadSchema.parse(entity.winningMutation.payload).parentDeckId);
    for (const entity of registrationOrder) {
      const mutation = entity.winningMutation;
      if (catalog.some((control) => control.deckId === mutation.entityId)) continue;
      const previous = await this.state(mutation.entityId);
      if (previous?.removed || previous?.deleted) continue;
      this.deckTitle = localDeckPayloadSchema.parse(mutation.payload).title;
      this.progress("catalog");
      const control = cloudDeckControlSchema.parse({ ...this.input.identity, protocolVersion: 1,
        deckId: mutation.entityId, deckGeneration: crypto.randomUUID(), progressGeneration: crypto.randomUUID(), deleted: false });
      await this.input.library.registerDeck(control);
      catalog.push(control);
    }

    type Prepared = {candidate: CloudDeckControl; activation: CloudCuratedDeckActivation | null; error?: unknown};
    const prepared: Prepared[] = [];
    for (const [index, candidate] of catalog.entries()) {
      this.deckTitle = localContent.get(candidate.deckId)?.deck.title;
      this.progress("catalog", index + 1, catalog.length);
      try {
        const ledger = await this.input.library.describeDeck(candidate.deckId);
        let activation: CloudCuratedDeckActivation | null = null;
        if (!ledger.deletion && !ledger.control.deleted) {
          const store = this.input.library.deckStore(ledger.control);
          const localActivation = this.activation(ledger.control, localContent.get(candidate.deckId) ?? null);
          if (localActivation) await this.publishActivation(store, localActivation);
          const record = await store.read("activation.v1");
          if (record) activation = this.parseActivation(record.value, ledger.control);
        }
        prepared.push({candidate, activation});
      } catch (error) {
        prepared.push({candidate, activation: null, error});
      }
    }
    const ordered = parentFirst(prepared, (item) => item.candidate.deckId, (item) =>
      item.activation?.parentDeckId ?? localContent.get(item.candidate.deckId)?.deck.parentDeckId);
    const results: CloudDeckSyncResult[] = [];
    for (const preparedDeck of ordered) {
      const candidate = preparedDeck.candidate;
      let state = await this.state(candidate.deckId);
      this.deckTitle = state?.base?.deck.title ?? cloudContentFromSnapshot(initial, candidate.deckId)?.deck.title;
      this.progress("catalog");
      let revisions: CloudDeckRevision[] = [];
      try {
        if (preparedDeck.error) throw preparedDeck.error;
        let ledger = await this.input.library.describeDeck(candidate.deckId);
        if (ledger.deletion) {
          this.progress("delete");
          for (let page = 0; page < 2048; page++) {
            if (await this.input.library.continueDeletion(candidate.deckId, ledger.deletion.operationId)) break;
          }
          ledger = await this.input.library.describeDeck(candidate.deckId);
          if (ledger.deletion) throw new Error("Cloud erasure still pending");
        }
        const control = ledger.control;
        if (control.deleted) {
          if (state && !state.deleted) {
            await this.input.blockWrites();
            await this.eraseLocal(control.deckId, "deck");
            state = {...state, control, base: null, pending: null, deleted: true};
            await this.save(state);
          }
          results.push({deckId: control.deckId, title: state?.base?.deck.title ?? control.deckId,
            removed: true, status: "deleted", revisions: []});
          continue;
        }
        if (state && state.control.deckGeneration !== control.deckGeneration) throw new Error("Deck generation changed");
        if (state && state.control.progressGeneration !== control.progressGeneration) {
          await this.input.blockWrites();
          await this.eraseLocal(control.deckId, "progress");
          state = {...state, control};
          await this.save(state);
        }
        state ??= {control, base: null, revisionId: null, removed: false, deleted: false, pending: null};
        if (state.curated && !preparedDeck.activation) throw new Error("Curated activation disappeared; preserve local data");
        if (preparedDeck.activation) state.curated = preparedDeck.activation;
        await this.save(state); // Bind progress generation before reading local reviews.
        if (state.removed) {
          results.push({deckId: control.deckId, title: state.base?.deck.title ?? state.curated?.sourceTemplateKey ?? control.deckId,
            removed: true, status: "synced", revisions: []});
          continue;
        }
        if (preparedDeck.activation) {
          if (!this.input.installCuratedDeck) throw new Error("Curated catalog installer is unavailable");
          this.progress("activate", 0, 1);
          await this.input.installCuratedDeck(preparedDeck.activation);
          this.progress("activate", 1, 1);
          const snapshot = await this.input.authority.exportAll();
          const local = cloudContentFromSnapshot(snapshot, control.deckId);
          if (!local || local.deck.sourceTemplateKey !== preparedDeck.activation.sourceTemplateKey)
            throw new Error("Verified curated activation did not install the expected deck");
          this.deckTitle = local.deck.title;
          const store = this.input.library.deckStore(control);
          const outboxIds = new Set(snapshot.payload.outboxMutationIds);
          const pendingReviewIds = new Set(snapshot.payload.mutationJournal.filter((mutation) =>
            mutation.entityType === "REVIEW" && outboxIds.has(mutation.mutationId))
            .map((mutation) => mutation.entityId));
          const localReviews = reviewsFromSnapshot(snapshot, control).filter((event) =>
            pendingReviewIds.has(event.review.reviewId));
          this.progress("reviews", 0, localReviews.length);
          for (const [index, review] of localReviews.entries()) {
            await publishCloudReview(store, review, this.clock());
            this.progress("reviews", index + 1, localReviews.length);
          }
          const names = await this.input.library.listPayloadNames(control);
          const reviews: CloudReviewEvent[] = [];
          const reviewNames = names.filter((name) => name.startsWith("review."));
          this.progress("reviews", 0, reviewNames.length);
          for (const [index, name] of reviewNames.entries()) {
            const record = await store.read(name);
            if (!record) throw new Error("Cloud review disappeared");
            reviews.push(cloudReviewEventSchema.parse(record.value));
            this.progress("reviews", index + 1, reviewNames.length);
          }
          await this.project(snapshot, control, local, reviews);
          state.base = null; state.revisionId = null; state.pending = null;
          await this.save(state);
          await this.acknowledge(snapshot, control, store, "activation.v1");
          results.push({deckId: control.deckId, title: local.deck.title, removed: false,
            status: "synced", revisions: []});
          continue;
        }
        if (state.pending) await this.publish(state, state.pending.content, state.pending.revision.parentRevisionIds);
        const store = this.input.library.deckStore(control);
        const snapshot = await this.input.authority.exportAll();
        const local = cloudContentFromSnapshot(snapshot, control.deckId);
        const outboxIds = new Set(snapshot.payload.outboxMutationIds);
        const pendingReviews = new Set(snapshot.payload.mutationJournal.filter((m) =>
          m.entityType === "REVIEW" && outboxIds.has(m.mutationId)).map((m) => m.entityId));
        const localReviews = reviewsFromSnapshot(snapshot, control).filter((event) =>
          !state?.base || pendingReviews.has(event.review.reviewId));
        this.progress("reviews", 0, localReviews.length);
        for (const [index, review] of localReviews.entries()) {
          await publishCloudReview(store, review, this.clock());
          this.progress("reviews", index + 1, localReviews.length);
        }
        const names = await this.input.library.listPayloadNames(control);
        const reviews: CloudReviewEvent[] = [];
        for (const name of names) {
          this.input.checkActive?.();
          if (!name.startsWith("revision.") && !name.startsWith("review.")) continue;
          const record = await store.read(name);
          if (!record) throw new Error("Catalog payload disappeared");
          if (name.startsWith("revision.")) {
            const revision = cloudDeckRevisionSchema.parse(record.value);
            if (revision.deckId !== control.deckId || revision.deckGeneration !== control.deckGeneration ||
                revision.libraryId !== control.libraryId || revision.libraryGeneration !== control.libraryGeneration)
              throw new Error("Revision scope mismatch");
            revisions.push(revision);
          } else reviews.push(cloudReviewEventSchema.parse(record.value));
        }
        const heads = cloudDeckRevisionHeads(revisions);
        const choice = resolve?.deckId === control.deckId ? resolve.revisionId : undefined;
        if (heads.length > 1 && !choice) {
          if (local) await this.project(snapshot, control, local, reviews);
          throw new CloudContentConflict(control.deckId);
        }
        const chosen = choice && choice !== "local" ? heads.find((h) => h.revisionId === choice) : heads[0];
        if (choice && choice !== "local" && !chosen) throw new Error("Selected conflict revision changed");
        let content = local;
        let remoteContent: CloudDeckContent | null = null;
        if (chosen && choice !== "local") {
          // A durably installed immutable revision is already verified. Avoid
          // downloading its full package again on every foreground refresh.
          if (state.revisionId === chosen.revisionId && state.base && local) remoteContent = state.base;
          else {
            const remote = await this.contentPackage(store, chosen);
            await this.installMedia(store, remote);
            remoteContent = remote.content;
          }
          content = choice ? remoteContent : mergeCloudContents(state.base, local, remoteContent);
        }
        if (!content) throw new Error("Deck has no complete content revision yet");
        await this.project(snapshot, control, content, reviews);
        if (choice || !chosen || !same(content, remoteContent)) {
          await this.publish(state, content, heads.map((h) => h.revisionId));
        } else {
          state.base = content; state.revisionId = chosen.revisionId; await this.save(state);
        }
        // Only this pre-transfer snapshot is acknowledged. Reviews created during
        // the run remain pending, and settings/plan mutations are not cloud receipts.
        await this.acknowledge(snapshot, control, store, `revision.${state.revisionId}`);
        results.push({deckId: control.deckId, title: content.deck.title, removed: false, status: "synced", revisions: []});
      } catch (error) {
        this.input.checkActive?.();
        if (error instanceof CloudLibraryError && error.code === "ACCOUNT_CHANGED") throw error;
        results.push({deckId: candidate.deckId, title: state?.base?.deck.title ??
          cloudContentFromSnapshot(initial, candidate.deckId)?.deck.title ?? candidate.deckId,
          removed: state?.removed ?? false, status: error instanceof CloudContentConflict ? "conflict" : "error",
          revisions: cloudDeckRevisionHeads(revisions).map((r) => r.revisionId), problem: cloudTransferProblem(error)});
      }
    }
    return results;
  }

  async eraseLocal(deckId: string, kind: "deck" | "progress" | "remove") {
    this.progress("delete");
    const snapshot = await this.input.authority.exportAll();
    const owned = new Set<string>();
    for (const m of snapshot.payload.mutationJournal) {
      if (m.entityId === deckId || (m.payload && typeof m.payload === "object" &&
          "deckId" in m.payload && m.payload.deckId === deckId)) {
        if (kind === "progress" && !["CARD", "REVIEW"].includes(m.entityType)) continue;
        if (kind === "remove" && m.entityType === "REVIEW") continue;
        owned.add(m.entityId);
      }
    }
    const replacements: LocalMutationInput[] = kind === "progress" ? snapshot.payload.entities.flatMap((e) => {
      const m = e.winningMutation;
      if (!owned.has(m.entityId) || m.entityType !== "CARD" || m.operation === "DELETE") return [];
      const card = localCardPayloadSchema.parse(m.payload);
      return [{entityId: m.entityId, entityType: "CARD" as const, operation: "UPSERT" as const, baseVersion: null,
        payload: {...card, state: emptyCardState(new Date(card.createdAt)), introducedAt: null}}];
    }) : [];
    this.input.checkActive?.();
    await this.input.authority.eraseCloudEntities([...owned], replacements, snapshot.payload.replicaWatermarks);
  }
  async executeCommand(command: {deckId: string; operationId: string; kind: "deck" | "progress" | "remove"; nextGeneration: string}) {
    this.progress("delete");
    await this.input.assertAccount();
    const state = await this.state(command.deckId);
    if (!state) throw new Error("Deck has not been linked; synchronize before deletion");
    // Persist every completed command, not just the latest one: delayed retries
    // of an older reset must remain harmless after subsequent resets/reviews.
    if (state.completedCommands?.includes(command.operationId)) return;
    if (command.kind === "remove") {
      const store = this.input.library.deckStore(state.control);
      if (state.curated) {
        const confirmed = await store.read("activation.v1");
        if (!confirmed || !same(this.parseActivation(confirmed.value, state.control), state.curated))
          throw new Error("Curated activation is missing; preserve the local download");
      } else {
        if (!state.revisionId || state.pending) throw new Error("Deck upload must finish before removing its download");
        const confirmed = await store.read(`revision.${state.revisionId}`);
        if (!confirmed || cloudDeckRevisionSchema.parse(confirmed.value).revisionId !== state.revisionId)
          throw new Error("Cloud revision is missing; preserve the local download");
      }
      state.removed = true;
      await this.save(state); // Removal intent survives local transaction failure.
      await this.eraseLocal(command.deckId, "remove");
      state.completedCommands = [...(state.completedCommands ?? []), command.operationId];
      await this.save(state);
      return;
    }
    await this.input.library.beginDeletion(state.control, command.operationId,
      command.kind === "progress" ? command.nextGeneration : undefined);
    for (let page = 0; page < 2048; page++) {
      if (await this.input.library.continueDeletion(command.deckId, command.operationId)) break;
    }
    const ledger = await this.input.library.describeDeck(command.deckId);
    if (ledger.deletion || ledger.lastDeletionId !== command.operationId) throw new Error("Physical cloud erasure not finished");
    await this.eraseLocal(command.deckId, command.kind);
    state.control = ledger.control; state.pending = null;
    state.completedCommands = [...(state.completedCommands ?? []), command.operationId];
    if (command.kind === "deck") { state.deleted = true; state.base = null; state.removed = true; }
    await this.save(state);
  }
  async restoreDownload(deckId: string) {
    const state = await this.state(deckId);
    if (!state || state.deleted) throw new Error("Cloud deck was deleted");
    state.removed = false; await this.save(state);
  }
}
