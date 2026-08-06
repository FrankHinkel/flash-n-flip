"use client";

import type { DeckDetail } from "@flashcards/api-client";
import {
  createId,
  parseTransferableDeck,
  peerTransferManifestSchema,
  peerMutationSchema,
  replicaWatermarksSchema,
  type PeerTransferManifest,
  type PeerMutation,
  type ReplicaWatermarks,
  type TransferMedia,
} from "@flashcards/domain";
import {
  chunkByteRange,
  chunkCount,
  defaultTransferChunkSize,
  IncrementalSha256,
  maximumBufferedTransferBytes,
  maximumTransferBytes,
  maximumTransferMetadataBytes,
} from "@flashcards/peer-transfer";
import { mutationsMissingFromReplica } from "@flashcards/sync";
import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";

import { api } from "./api";
import {
  clearTransferChunks,
  commitTransferredDeck,
  applyPeerMutationBatch,
  deleteTransferStaging,
  getCachedDeckDetail,
  getCachedMedia,
  getPeerMutations,
  getReplicaWatermarks,
  getTransferChunkIndexes,
  getTransferChunks,
  getTransferSessions,
  storeTransferChunk,
  storeTransferSession,
  type LocalTransferSession,
} from "./offline";
import {
  cardContentMediaIds,
  downloadMediaOfflineFirst,
} from "./offline-media";

type OfferMessage = {
  type: "OFFER";
  manifest: PeerTransferManifest;
  deck: unknown;
};
type AcceptMessage = {
  type: "ACCEPT";
  transferId: string;
  received: Record<string, number[]>;
};
type RejectMessage = {
  type: "REJECT";
  transferId: string;
  reason: string;
};
type ChunkMessage = {
  type: "CHUNK";
  transferId: string;
  mediaId: string;
  index: number;
  byteSize: number;
  sha256: string;
};
type CompleteMessage = { type: "COMPLETE"; transferId: string };
type ResultMessage = {
  type: "RESULT";
  transferId: string;
  ok: boolean;
  reason?: string;
};
type SyncHelloMessage = {
  type: "SYNC_HELLO";
  watermarks: ReplicaWatermarks;
};
type SyncBatchMessage = {
  type: "SYNC_BATCH";
  mutations: PeerMutation[];
};
type SyncAckMessage = {
  type: "SYNC_ACK";
  watermarks: ReplicaWatermarks;
};
type WireMessage =
  | OfferMessage
  | AcceptMessage
  | RejectMessage
  | ChunkMessage
  | CompleteMessage
  | ResultMessage
  | SyncHelloMessage
  | SyncBatchMessage
  | SyncAckMessage;

type PreparedTransfer = {
  manifest: PeerTransferManifest;
  deck: DeckDetail;
  media: Map<string, Blob>;
};

export type IncomingDeckTransfer = {
  transferId: string;
  deckTitle: string;
  cardCount: number;
  mediaCount: number;
  totalBytes: number;
};

export type DeckTransferProgress = {
  transferId: string;
  direction: "SEND" | "RECEIVE";
  deckTitle: string;
  state: LocalTransferSession["state"];
  verifiedBytes: number;
  totalBytes: number;
  verifiedObjects: number;
  totalObjects: number;
  error: string | null;
};

const encoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array): string =>
  [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");

const sha256Bytes = async (bytes: Uint8Array): Promise<string> =>
  bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ),
    ),
  );

const sha256Text = (value: string): string =>
  new IncrementalSha256().update(encoder.encode(value)).digestHex();

const referencedMediaIds = (deck: DeckDetail): string[] => {
  const ids = new Set<string>();
  if (deck.visual?.kind === "IMAGE") ids.add(deck.visual.value);
  for (const card of deck.cards) {
    const contents = [
      card.front,
      card.back,
      ...Object.values(card.translations).flatMap((translation) => [
        translation.front,
        translation.back,
      ]),
    ];
    for (const content of contents) {
      cardContentMediaIds(content).forEach((id) => ids.add(id));
    }
  }
  return [...ids];
};

const manifestMetadataByteSize = (manifest: PeerTransferManifest): number =>
  manifest.totalBytes -
  manifest.media.reduce((sum, media) => sum + media.byteSize, 0);

const prepareMedia = async (
  id: string,
  blob: Blob,
  chunkSize: number,
): Promise<TransferMedia> => {
  const fullHash = new IncrementalSha256();
  const chunkHashes: string[] = [];
  const count = chunkCount(blob.size, chunkSize);
  for (let index = 0; index < count; index += 1) {
    const range = chunkByteRange(blob.size, chunkSize, index);
    const bytes = new Uint8Array(
      await blob.slice(range.start, range.end).arrayBuffer(),
    );
    fullHash.update(bytes);
    chunkHashes.push(await sha256Bytes(bytes));
  }
  return {
    id,
    mimeType: blob.type || "application/octet-stream",
    byteSize: blob.size,
    sha256: fullHash.digestHex(),
    chunkHashes,
  };
};

const loadDeck = async (deckId: string): Promise<DeckDetail> => {
  try {
    const deck = await api.getDeck(deckId);
    return parseTransferableDeck(deck) as DeckDetail;
  } catch (error) {
    const cached = await getCachedDeckDetail(deckId);
    if (cached) return parseTransferableDeck(cached) as DeckDetail;
    throw error;
  }
};

async function prepareTransfer(
  deckId: string,
  senderDeviceId: string,
  transferId = createId(),
): Promise<PreparedTransfer> {
  const deck = await loadDeck(deckId);
  const deckJson = JSON.stringify(deck);
  if (encoder.encode(deckJson).byteLength > maximumTransferMetadataBytes) {
    throw new Error("Deck metadata exceeds the direct-transfer limit");
  }
  const media = new Map<string, Blob>();
  const mediaManifest: TransferMedia[] = [];
  for (const mediaId of referencedMediaIds(deck)) {
    const blob = await downloadMediaOfflineFirst(mediaId);
    media.set(mediaId, blob);
    mediaManifest.push(
      await prepareMedia(mediaId, blob, defaultTransferChunkSize),
    );
  }
  const totalBytes =
    encoder.encode(deckJson).byteLength +
    mediaManifest.reduce((sum, item) => sum + item.byteSize, 0);
  if (totalBytes > maximumTransferBytes) {
    throw new Error("Deck exceeds the direct-transfer size limit");
  }
  const manifest = peerTransferManifestSchema.parse({
    version: 1,
    transferId,
    kind: "DECK_COPY",
    senderDeviceId,
    rootDeckIds: [deck.id],
    deckCount: 1,
    cardCount: deck.cards.length,
    noteCount: new Set(deck.cards.map((card) => card.noteId)).size,
    mediaCount: mediaManifest.length,
    totalBytes,
    chunkSize: defaultTransferChunkSize,
    includesLearningProgress: false,
    manifestPayloadHash: sha256Text(deckJson),
    media: mediaManifest,
    createdAt: new Date().toISOString(),
  });
  return { manifest, deck, media };
}

const encodeMessage = (message: WireMessage): string => {
  const encoded = JSON.stringify(message);
  if (encoder.encode(encoded).byteLength > maximumTransferMetadataBytes) {
    throw new Error("Transfer message exceeds the metadata limit");
  }
  return encoded;
};

const decodeMessage = (value: string): WireMessage => {
  if (encoder.encode(value).byteLength > maximumTransferMetadataBytes) {
    throw new Error("Transfer message exceeds the metadata limit");
  }
  const parsed = JSON.parse(value) as Partial<WireMessage>;
  if (typeof parsed.type !== "string")
    throw new Error("Invalid transfer message");
  return parsed as WireMessage;
};

const waitForWritableChannel = async (channel: RTCDataChannel) => {
  if (channel.readyState !== "open")
    throw new Error("Direct connection is closed");
  if (channel.bufferedAmount <= maximumBufferedTransferBytes) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Direct transfer timed out while buffering"));
    }, 30_000);
    const handleLow = () => {
      cleanup();
      resolve();
    };
    const handleClose = () => {
      cleanup();
      reject(new Error("Direct connection closed during transfer"));
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      channel.removeEventListener("bufferedamountlow", handleLow);
      channel.removeEventListener("close", handleClose);
    };
    channel.addEventListener("bufferedamountlow", handleLow, { once: true });
    channel.addEventListener("close", handleClose, { once: true });
  });
};

export const validateTransferredMedia = async (
  blob: Blob,
  mimeType: string,
): Promise<boolean> => {
  if (blob.size === 0) return false;
  if (mimeType === "image/svg+xml") {
    if (blob.size > 2 * 1024 * 1024) return false;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sanitized = sanitizeSvgBytes(bytes);
    return (
      sanitized !== null &&
      sanitized.byteLength === bytes.byteLength &&
      sanitized.every((value, index) => value === bytes[index])
    );
  }
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const text = String.fromCharCode(...bytes);
  if (mimeType === "image/png") {
    return bytes[0] === 0x89 && text.slice(1, 4) === "PNG";
  }
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/gif") return text.startsWith("GIF8");
  if (mimeType === "image/webp") {
    return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
  }
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    return text.startsWith("RIFF") && text.slice(8, 12) === "WAVE";
  }
  if (mimeType === "audio/ogg" || mimeType === "video/ogg") {
    return text.startsWith("OggS");
  }
  if (mimeType === "audio/mpeg") {
    return (
      text.startsWith("ID3") ||
      (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
    );
  }
  if (mimeType === "audio/mp4" || mimeType === "video/mp4") {
    return text.slice(4, 8) === "ftyp";
  }
  if (mimeType === "audio/webm" || mimeType === "video/webm") {
    return text.startsWith("\u001aEß£");
  }
  return false;
};

export function validateDeckTransferManifest(
  manifest: PeerTransferManifest,
  deck: DeckDetail,
  expectedSenderDeviceId: string,
): void {
  const deckJson = JSON.stringify(deck);
  const deckByteSize = encoder.encode(deckJson).byteLength;
  const noteCount = new Set(deck.cards.map((card) => card.noteId)).size;
  const declaredMedia = new Set(manifest.media.map((item) => item.id));
  const referencedMedia = referencedMediaIds(deck);
  const computedTotalBytes = manifest.media.reduce(
    (sum, media) => sum + media.byteSize,
    deckByteSize,
  );
  if (
    manifest.kind !== "DECK_COPY" ||
    manifest.senderDeviceId !== expectedSenderDeviceId ||
    manifest.rootDeckIds.length !== 1 ||
    manifest.rootDeckIds[0] !== deck.id ||
    manifest.deckCount !== 1 ||
    manifest.cardCount !== deck.cards.length ||
    manifest.noteCount !== noteCount ||
    manifest.mediaCount !== manifest.media.length ||
    manifest.mediaCount !== declaredMedia.size ||
    manifest.mediaCount !== referencedMedia.length ||
    manifest.includesLearningProgress ||
    computedTotalBytes !== manifest.totalBytes ||
    manifest.totalBytes > maximumTransferBytes
  ) {
    throw new Error("Deck transfer manifest does not match its payload");
  }
  if (
    manifest.media.some(
      (media) =>
        media.chunkHashes.length !==
        chunkCount(media.byteSize, manifest.chunkSize),
    )
  ) {
    throw new Error("Deck transfer chunk manifest is inconsistent");
  }
  if (sha256Text(deckJson) !== manifest.manifestPayloadHash) {
    throw new Error("Deck transfer metadata hash does not match");
  }
  if (referencedMedia.some((id) => !declaredMedia.has(id))) {
    throw new Error("Deck transfer media references do not match");
  }
}

export class PeerDeckTransferManager {
  private channel: RTCDataChannel | null = null;
  private localDeviceId = "";
  private remoteDeviceId = "";
  private outgoing: PreparedTransfer | null = null;
  private incoming: {
    manifest: PeerTransferManifest;
    deck: DeckDetail;
  } | null = null;
  private incomingHeader: ChunkMessage | null = null;
  private incomingVerifiedBytes = 0;
  private messageQueue = Promise.resolve();

  constructor(
    private readonly callbacks: {
      onIncoming(offer: IncomingDeckTransfer | null): void;
      onProgress(progress: DeckTransferProgress | null): void;
      onError(message: string): void;
    },
  ) {}

  attach(
    channel: RTCDataChannel,
    localDeviceId: string,
    remoteDeviceId: string,
  ) {
    this.detach();
    this.channel = channel;
    this.localDeviceId = localDeviceId;
    this.remoteDeviceId = remoteDeviceId;
    channel.binaryType = "arraybuffer";
    channel.addEventListener("message", this.handleMessage);
    if (this.outgoing) {
      channel.send(
        encodeMessage({
          type: "OFFER",
          manifest: this.outgoing.manifest,
          deck: this.outgoing.deck,
        }),
      );
    }
    void this.sendSyncHello().catch((error) => this.fail(error));
  }

  detach() {
    this.channel?.removeEventListener("message", this.handleMessage);
    this.channel = null;
  }

  async sendDeck(deckId: string): Promise<void> {
    if (!this.channel || this.channel.readyState !== "open") {
      throw new Error("No direct device connection is available");
    }
    if (this.outgoing) throw new Error("Another deck is already being sent");
    const resumable = (await getTransferSessions())
      .filter(
        (session) =>
          session.direction === "SEND" &&
          session.peerDeviceId === this.remoteDeviceId &&
          session.manifest?.rootDeckIds[0] === deckId &&
          session.state !== "COMPLETED" &&
          session.state !== "CANCELLED",
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    const prepared = await prepareTransfer(
      deckId,
      this.localDeviceId,
      resumable?.id,
    );
    if (
      resumable?.manifest &&
      resumable.manifest.manifestPayloadHash !==
        prepared.manifest.manifestPayloadHash
    ) {
      prepared.manifest = peerTransferManifestSchema.parse({
        ...prepared.manifest,
        transferId: createId(),
      });
    }
    this.outgoing = prepared;
    const session: LocalTransferSession = {
      id: prepared.manifest.transferId,
      peerDeviceId: this.remoteDeviceId,
      direction: "SEND",
      state: "AWAITING_ACCEPTANCE",
      manifest: prepared.manifest,
      verifiedBytes: 0,
      verifiedObjects: 0,
      updatedAt: new Date().toISOString(),
      error: null,
    };
    await storeTransferSession(session);
    this.emitProgress(session, prepared.deck.title);
    this.channel.send(
      encodeMessage({
        type: "OFFER",
        manifest: prepared.manifest,
        deck: prepared.deck,
      }),
    );
  }

  async acceptIncoming(): Promise<void> {
    if (!this.incoming || !this.channel) return;
    const received: Record<string, number[]> = {};
    this.incomingVerifiedBytes = manifestMetadataByteSize(
      this.incoming.manifest,
    );
    for (const media of this.incoming.manifest.media) {
      received[media.id] = await getTransferChunkIndexes(
        this.incoming.manifest.transferId,
        media.id,
      );
      const chunks = await getTransferChunks(
        this.incoming.manifest.transferId,
        media.id,
      );
      this.incomingVerifiedBytes += chunks.reduce(
        (sum, chunk) => sum + chunk.data.size,
        0,
      );
    }
    const session = this.incomingSession("TRANSFERRING");
    session.verifiedBytes = this.incomingVerifiedBytes;
    await storeTransferSession(session);
    this.emitProgress(session, this.incoming.deck.title);
    this.channel.send(
      encodeMessage({
        type: "ACCEPT",
        transferId: this.incoming.manifest.transferId,
        received,
      }),
    );
    this.callbacks.onIncoming(null);
  }

  rejectIncoming(reason = "Transfer declined") {
    if (!this.incoming || !this.channel) return;
    const transferId = this.incoming.manifest.transferId;
    this.channel.send(
      encodeMessage({
        type: "REJECT",
        transferId,
        reason,
      }),
    );
    this.incoming = null;
    this.callbacks.onIncoming(null);
    void deleteTransferStaging(transferId).catch((error) => this.fail(error));
  }

  private readonly handleMessage = (event: MessageEvent) => {
    this.messageQueue = this.messageQueue
      .then(() => this.consumeMessage(event.data))
      .catch((error) => this.fail(error));
  };

  private async consumeMessage(data: unknown): Promise<void> {
    if (typeof data !== "string") {
      if (!(data instanceof ArrayBuffer))
        throw new Error("Invalid binary transfer frame");
      await this.receiveChunk(data);
      return;
    }
    const message = decodeMessage(data);
    if (message.type === "OFFER") await this.receiveOffer(message);
    else if (message.type === "ACCEPT") await this.transmit(message);
    else if (message.type === "REJECT") this.receiveReject(message);
    else if (message.type === "CHUNK") this.receiveChunkHeader(message);
    else if (message.type === "COMPLETE") await this.commitIncoming(message);
    else if (message.type === "RESULT") this.receiveResult(message);
    else if (message.type === "SYNC_HELLO")
      await this.receiveSyncHello(message);
    else if (message.type === "SYNC_BATCH")
      await this.receiveSyncBatch(message);
    else if (message.type === "SYNC_ACK") {
      replicaWatermarksSchema.parse(message.watermarks);
    }
  }

  private async receiveOffer(message: OfferMessage): Promise<void> {
    if (this.incoming) throw new Error("Another incoming deck is waiting");
    const manifest = peerTransferManifestSchema.parse(message.manifest);
    const deck = parseTransferableDeck(message.deck) as DeckDetail;
    validateDeckTransferManifest(manifest, deck, this.remoteDeviceId);
    const deckJson = JSON.stringify(deck);
    const existingDeck = await getCachedDeckDetail(deck.id);
    if (existingDeck && JSON.stringify(existingDeck) !== deckJson) {
      throw new Error("A different local deck already uses this identity");
    }
    this.incoming = { manifest, deck };
    this.incomingVerifiedBytes = manifestMetadataByteSize(manifest);
    const session = this.incomingSession("AWAITING_ACCEPTANCE");
    await storeTransferSession(session);
    this.callbacks.onIncoming({
      transferId: manifest.transferId,
      deckTitle: deck.title,
      cardCount: manifest.cardCount,
      mediaCount: manifest.mediaCount,
      totalBytes: manifest.totalBytes,
    });
  }

  private receiveChunkHeader(message: ChunkMessage) {
    if (
      !this.incoming ||
      message.transferId !== this.incoming.manifest.transferId
    ) {
      throw new Error("Unexpected transfer chunk header");
    }
    const media = this.incoming.manifest.media.find(
      (item) => item.id === message.mediaId,
    );
    if (
      !media ||
      message.index < 0 ||
      message.index >= media.chunkHashes.length ||
      message.sha256 !== media.chunkHashes[message.index]
    ) {
      throw new Error("Invalid transfer chunk header");
    }
    const expectedRange = chunkByteRange(
      media.byteSize,
      this.incoming.manifest.chunkSize,
      message.index,
    );
    if (message.byteSize !== expectedRange.end - expectedRange.start) {
      throw new Error("Invalid transfer chunk size");
    }
    this.incomingHeader = message;
  }

  private async receiveChunk(data: ArrayBuffer): Promise<void> {
    const header = this.incomingHeader;
    this.incomingHeader = null;
    if (!header || !this.incoming)
      throw new Error("Unexpected transfer chunk data");
    if (data.byteLength !== header.byteSize)
      throw new Error("Transfer chunk size mismatch");
    const bytes = new Uint8Array(data);
    if ((await sha256Bytes(bytes)) !== header.sha256) {
      throw new Error("Transfer chunk hash mismatch");
    }
    await storeTransferChunk({
      transferId: header.transferId,
      mediaId: header.mediaId,
      index: header.index,
      sha256: header.sha256,
      data: new Blob([data]),
    });
    this.incomingVerifiedBytes += data.byteLength;
    const session = this.incomingSession("TRANSFERRING");
    session.verifiedBytes = this.incomingVerifiedBytes;
    await storeTransferSession(session);
    this.emitProgress(session, this.incoming.deck.title);
  }

  private async transmit(message: AcceptMessage): Promise<void> {
    const prepared = this.outgoing;
    const channel = this.channel;
    if (
      !prepared ||
      !channel ||
      message.transferId !== prepared.manifest.transferId
    ) {
      throw new Error("Unexpected transfer acceptance");
    }
    let sentBytes = manifestMetadataByteSize(prepared.manifest);
    for (const media of prepared.manifest.media) {
      const blob = prepared.media.get(media.id);
      if (!blob) throw new Error("Prepared media is unavailable");
      const alreadyReceived = new Set(message.received[media.id] ?? []);
      for (let index = 0; index < media.chunkHashes.length; index += 1) {
        const range = chunkByteRange(
          blob.size,
          prepared.manifest.chunkSize,
          index,
        );
        if (alreadyReceived.has(index)) {
          sentBytes += range.end - range.start;
          continue;
        }
        const data = await blob.slice(range.start, range.end).arrayBuffer();
        await waitForWritableChannel(channel);
        channel.send(
          encodeMessage({
            type: "CHUNK",
            transferId: prepared.manifest.transferId,
            mediaId: media.id,
            index,
            byteSize: data.byteLength,
            sha256: media.chunkHashes[index]!,
          }),
        );
        channel.send(data);
        sentBytes += data.byteLength;
        const session: LocalTransferSession = {
          id: prepared.manifest.transferId,
          peerDeviceId: this.remoteDeviceId,
          direction: "SEND",
          state: "TRANSFERRING",
          manifest: prepared.manifest,
          verifiedBytes: sentBytes,
          verifiedObjects: 0,
          updatedAt: new Date().toISOString(),
          error: null,
        };
        await storeTransferSession(session);
        this.emitProgress(session, prepared.deck.title);
      }
    }
    channel.send(
      encodeMessage({
        type: "COMPLETE",
        transferId: prepared.manifest.transferId,
      }),
    );
  }

  private async commitIncoming(message: CompleteMessage): Promise<void> {
    if (
      !this.incoming ||
      message.transferId !== this.incoming.manifest.transferId
    ) {
      throw new Error("Unexpected transfer completion");
    }
    const { manifest, deck } = this.incoming;
    const mediaBlobs = new Map<string, Blob>();
    for (const media of manifest.media) {
      const chunks = await getTransferChunks(manifest.transferId, media.id);
      if (
        chunks.length !== media.chunkHashes.length ||
        chunks.some(
          (chunk, index) =>
            chunk.index !== index || chunk.sha256 !== media.chunkHashes[index],
        )
      ) {
        throw new Error("Transfer is incomplete and can be resumed");
      }
      const hash = new IncrementalSha256();
      let byteSize = 0;
      for (const chunk of chunks) {
        const bytes = new Uint8Array(await chunk.data.arrayBuffer());
        hash.update(bytes);
        byteSize += bytes.byteLength;
      }
      if (byteSize !== media.byteSize || hash.digestHex() !== media.sha256) {
        throw new Error("Transferred media hash does not match");
      }
      const blob = new Blob(
        chunks.map((chunk) => chunk.data),
        { type: media.mimeType },
      );
      if (!(await validateTransferredMedia(blob, media.mimeType))) {
        throw new Error("Transferred media content is not recognized");
      }
      const existing = await getCachedMedia(media.id);
      if (existing) {
        const existingHash = new IncrementalSha256();
        for (
          let offset = 0;
          offset < existing.size;
          offset += defaultTransferChunkSize
        ) {
          existingHash.update(
            new Uint8Array(
              await existing
                .slice(offset, offset + defaultTransferChunkSize)
                .arrayBuffer(),
            ),
          );
        }
        if (
          existing.type !== media.mimeType ||
          existing.size !== media.byteSize ||
          existingHash.digestHex() !== media.sha256
        ) {
          throw new Error(
            "A different local medium already uses this identity",
          );
        }
      }
      mediaBlobs.set(media.id, blob);
    }
    const completed: LocalTransferSession = {
      ...this.incomingSession("COMPLETED"),
      verifiedBytes: manifest.totalBytes,
      verifiedObjects:
        manifest.deckCount +
        manifest.cardCount +
        manifest.noteCount +
        manifest.mediaCount,
    };
    await commitTransferredDeck({
      deck,
      media: mediaBlobs,
      session: completed,
    });
    await clearTransferChunks(manifest.transferId);
    this.emitProgress(completed, deck.title);
    this.channel?.send(
      encodeMessage({
        type: "RESULT",
        transferId: manifest.transferId,
        ok: true,
      }),
    );
    this.incoming = null;
  }

  private receiveReject(message: RejectMessage) {
    if (
      !this.outgoing ||
      message.transferId !== this.outgoing.manifest.transferId
    )
      return;
    this.callbacks.onError(message.reason);
    this.outgoing = null;
  }

  private receiveResult(message: ResultMessage) {
    if (
      !this.outgoing ||
      message.transferId !== this.outgoing.manifest.transferId
    )
      return;
    const prepared = this.outgoing;
    const session: LocalTransferSession = {
      id: prepared.manifest.transferId,
      peerDeviceId: this.remoteDeviceId,
      direction: "SEND",
      state: message.ok ? "COMPLETED" : "FAILED",
      manifest: prepared.manifest,
      verifiedBytes: message.ok ? prepared.manifest.totalBytes : 0,
      verifiedObjects: message.ok
        ? prepared.manifest.deckCount +
          prepared.manifest.cardCount +
          prepared.manifest.noteCount +
          prepared.manifest.mediaCount
        : 0,
      updatedAt: new Date().toISOString(),
      error: message.ok ? null : (message.reason ?? "Transfer failed"),
    };
    void storeTransferSession(session);
    this.emitProgress(session, prepared.deck.title);
    this.outgoing = null;
  }

  private async sendSyncHello(): Promise<void> {
    if (!this.channel || this.channel.readyState !== "open") return;
    this.channel.send(
      encodeMessage({
        type: "SYNC_HELLO",
        watermarks: await getReplicaWatermarks(),
      }),
    );
  }

  private async receiveSyncHello(message: SyncHelloMessage): Promise<void> {
    const channel = this.channel;
    if (!channel) return;
    const watermarks = replicaWatermarksSchema.parse(message.watermarks);
    const missing = mutationsMissingFromReplica(
      await getPeerMutations(),
      watermarks,
    );
    for (let offset = 0; offset < missing.length; offset += 100) {
      await waitForWritableChannel(channel);
      channel.send(
        encodeMessage({
          type: "SYNC_BATCH",
          mutations: missing.slice(offset, offset + 100),
        }),
      );
    }
  }

  private async receiveSyncBatch(message: SyncBatchMessage): Promise<void> {
    const mutations = message.mutations.map((mutation) =>
      peerMutationSchema.parse(mutation),
    );
    const watermarks = await applyPeerMutationBatch(mutations);
    this.channel?.send(encodeMessage({ type: "SYNC_ACK", watermarks }));
  }

  private incomingSession(
    state: LocalTransferSession["state"],
  ): LocalTransferSession {
    if (!this.incoming) throw new Error("No incoming transfer exists");
    return {
      id: this.incoming.manifest.transferId,
      peerDeviceId: this.remoteDeviceId,
      direction: "RECEIVE",
      state,
      manifest: this.incoming.manifest,
      verifiedBytes: this.incomingVerifiedBytes,
      verifiedObjects: 0,
      updatedAt: new Date().toISOString(),
      error: null,
    };
  }

  private emitProgress(session: LocalTransferSession, deckTitle: string) {
    const manifest = session.manifest;
    if (!manifest) return;
    this.callbacks.onProgress({
      transferId: session.id,
      direction: session.direction,
      deckTitle,
      state: session.state,
      verifiedBytes: session.verifiedBytes,
      totalBytes: manifest.totalBytes,
      verifiedObjects: session.verifiedObjects,
      totalObjects:
        manifest.deckCount +
        manifest.cardCount +
        manifest.noteCount +
        manifest.mediaCount,
      error: session.error,
    });
  }

  private fail(error: unknown) {
    const message =
      error instanceof Error ? error.message : "Direct transfer failed";
    this.callbacks.onError(message);
  }
}
