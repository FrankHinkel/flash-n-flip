import {
  localPeerMessageSchema,
  localPeerProtocolVersion,
} from "@flashcards/domain/local-peer-protocol";
import {
  peerMutationSchema,
  type PeerMutation,
  type ReplicaWatermarks,
} from "@flashcards/domain/device-sync";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";

import type { DirectConnection } from "./peer";
import type { LocalAppRepository, LocalPeerMediaDescriptor } from "./local-app";
import { publishDirectPeerDeviceId } from "./connection-state";

export const localPeerMediaChunkBytes = 24 * 1024;
export const localPeerMutationChunkBytes = 24 * 1024;
export const localPeerMaximumMessageBytes = 48 * 1024;
type LocalPeerMediaSync = Pick<
  LocalAppRepository,
  | "peerMediaInventory"
  | "peerMediaMissingChunks"
  | "peerMediaBytes"
  | "acceptPeerMediaChunk"
>;

const batch = <T>(values: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const waitForBackpressure = async (channel: RTCDataChannel): Promise<void> => {
  const resumeBelowBytes = 256 * 1024;
  if (channel.bufferedAmount < 1024 * 1024) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(
      () =>
        finish(
          new Error("Der Direktabgleich wartet zu lange auf den Versand."),
        ),
      30_000,
    );
    const onLow = () => finish();
    const onClose = () =>
      finish(
        new Error("Die Direktverbindung wurde während des Versands beendet."),
      );
    const finish = (cause?: Error) => {
      globalThis.clearTimeout(timeout);
      channel.removeEventListener("bufferedamountlow", onLow);
      channel.removeEventListener("close", onClose);
      if (cause) reject(cause);
      else resolve();
    };
    channel.addEventListener("bufferedamountlow", onLow);
    channel.addEventListener("close", onClose);
    channel.bufferedAmountLowThreshold = resumeBelowBytes;
    // Safari can drain the buffer between the first size check and listener
    // registration without emitting another bufferedamountlow event.
    if (channel.bufferedAmount <= resumeBelowBytes) finish();
  });
};

const mutationBatchBytes = (entries: readonly PeerMutation[]): number =>
  new TextEncoder().encode(
    JSON.stringify({
      kind: "LOCAL_SYNC_MUTATIONS",
      version: localPeerProtocolVersion,
      mutations: entries,
    }),
  ).byteLength;

const sha256Hex = async (bytes: Uint8Array): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

type IncomingMutation = {
  sha256: string;
  byteSize: number;
  chunkCount: number;
  chunks: Map<number, Uint8Array>;
};

export class LocalPeerSynchronizer {
  private messageTail: Promise<void> = Promise.resolve();
  private readonly listeningChannels = new WeakSet<RTCDataChannel>();
  private deferLocalMessages = false;
  private readonly deferredLocalMessages: Array<{
    connection: DirectConnection;
    data: unknown;
  }> = [];
  private readonly incomingMutations = new Map<string, IncomingMutation>();
  private readonly peerHelloChannels = new WeakSet<RTCDataChannel>();
  private readonly peerHelloWaiters = new WeakMap<
    RTCDataChannel,
    Set<() => void>
  >();

  constructor(
    private readonly authority: LocalAuthorityRepository,
    private readonly deviceId: string,
    private readonly onChanged: () => void | Promise<void>,
    private readonly onUnknown?: (value: unknown) => void | Promise<void>,
    private readonly media?: LocalPeerMediaSync,
    private readonly onError?: (cause: unknown) => void | Promise<void>,
    private readonly publicKey?: string,
    private readonly onPeerIdentity?: (peer: {
      deviceId: string;
      publicKey?: string;
    }) => void | Promise<void>,
    private readonly onActivity?: () => void,
    private readonly isLibraryEmpty?: () => boolean | Promise<boolean>,
    private readonly onOutboxAcknowledged?: () => void | Promise<void>,
  ) {}

  private async send(
    connection: DirectConnection,
    message: unknown,
  ): Promise<void> {
    if (connection.channel.readyState !== "open")
      throw new Error("Direktverbindung ist nicht geöffnet.");
    await waitForBackpressure(connection.channel);
    connection.channel.send(JSON.stringify(message));
    this.onActivity?.();
  }

  private async sendMutations(
    connection: DirectConnection,
    mutations: readonly PeerMutation[],
  ): Promise<void> {
    let entries: PeerMutation[] = [];
    const flush = async () => {
      if (!entries.length) return;
      await this.send(connection, {
        kind: "LOCAL_SYNC_MUTATIONS",
        version: localPeerProtocolVersion,
        mutations: entries,
      });
      entries = [];
    };
    for (const mutation of mutations) {
      if (mutationBatchBytes([mutation]) > localPeerMaximumMessageBytes) {
        await flush();
        const bytes = new TextEncoder().encode(JSON.stringify(mutation));
        const chunks = batch([...bytes], localPeerMutationChunkBytes).map(
          (chunk) => Uint8Array.from(chunk),
        );
        const sha256 = await sha256Hex(bytes);
        for (const [index, chunk] of chunks.entries()) {
          await this.send(connection, {
            kind: "LOCAL_SYNC_MUTATION_CHUNK",
            version: localPeerProtocolVersion,
            mutationId: mutation.mutationId,
            sha256,
            byteSize: bytes.byteLength,
            index,
            chunkCount: chunks.length,
            dataBase64: bytesToBase64(chunk),
          });
        }
        continue;
      }
      const candidate = [...entries, mutation];
      if (
        candidate.length > 100 ||
        mutationBatchBytes(candidate) > localPeerMaximumMessageBytes
      ) {
        await flush();
      }
      entries.push(mutation);
    }
    await flush();
  }

  listen(
    connection: DirectConnection,
    options: { deferLocalMessages?: boolean } = {},
  ): void {
    this.deferLocalMessages = Boolean(options.deferLocalMessages);
    if (this.listeningChannels.has(connection.channel)) return;
    this.listeningChannels.add(connection.channel);
    connection.channel.addEventListener("message", (event) => {
      this.onActivity?.();
      if (this.deferLocalMessages && this.isLocalMessage(event.data)) {
        this.deferredLocalMessages.push({ connection, data: event.data });
        return;
      }
      this.enqueue(connection, event.data);
    });
  }

  private enqueue(connection: DirectConnection, data: unknown): void {
    // RTCDataChannel messages are ordered, but async event handlers are not.
    // Serialize every admitted message. During the initial handoff, known
    // sync messages are held outside this queue so the signed app can be
    // installed before a large deck or media journal consumes the channel.
    this.messageTail = this.messageTail
      .then(() => this.receive(connection, data))
      .catch((cause) => {
        console.error("Local peer synchronization failed", cause);
        if (this.onError) {
          void Promise.resolve()
            .then(() => this.onError!(cause))
            .catch((callbackCause) =>
              console.error("Local peer error callback failed", callbackCause),
            );
        }
        throw cause;
      });
    // Keep the rejected tail as a barrier for every later message while
    // preventing an unhandled-rejection report from the event callback.
    void this.messageTail.catch(() => undefined);
  }

  private isLocalMessage(raw: unknown): boolean {
    try {
      const text =
        typeof raw === "string"
          ? raw
          : new TextDecoder().decode(raw as ArrayBuffer);
      const candidate = JSON.parse(text) as unknown;
      return Boolean(
        candidate &&
        typeof candidate === "object" &&
        "kind" in candidate &&
        typeof candidate.kind === "string" &&
        candidate.kind.startsWith("LOCAL_SYNC_"),
      );
    } catch {
      return false;
    }
  }

  resumeLocalMessages(): void {
    this.deferLocalMessages = false;
    for (const message of this.deferredLocalMessages.splice(0)) {
      this.enqueue(message.connection, message.data);
    }
  }

  discardDeferredMessages(connection: DirectConnection): void {
    for (
      let index = this.deferredLocalMessages.length - 1;
      index >= 0;
      index--
    ) {
      if (this.deferredLocalMessages[index]?.connection === connection)
        this.deferredLocalMessages.splice(index, 1);
    }
  }

  async announce(connection: DirectConnection): Promise<void> {
    await this.send(connection, {
      kind: "LOCAL_SYNC_HELLO",
      version: localPeerProtocolVersion,
      deviceId: this.deviceId,
      ...(this.publicKey ? { publicKey: this.publicKey } : {}),
      watermarks: await this.authority.getReplicaWatermarks(),
      libraryEmpty: (await this.isLibraryEmpty?.()) ?? false,
    });
  }

  async start(connection: DirectConnection): Promise<void> {
    this.listen(connection);
    await this.announce(connection);
  }

  async whenIdle(): Promise<void> {
    const barrier = this.messageTail;
    try {
      await barrier;
    } catch (cause) {
      if (this.messageTail === barrier) this.messageTail = Promise.resolve();
      throw cause;
    }
  }

  async waitForPeerHello(
    connection: DirectConnection,
    timeoutMs = 30_000,
  ): Promise<void> {
    if (this.peerHelloChannels.has(connection.channel)) return;
    await new Promise<void>((resolve, reject) => {
      const waiters =
        this.peerHelloWaiters.get(connection.channel) ?? new Set();
      this.peerHelloWaiters.set(connection.channel, waiters);
      const finish = (cause?: Error) => {
        globalThis.clearTimeout(timeout);
        connection.channel.removeEventListener("close", onClose);
        waiters.delete(onHello);
        if (cause) reject(cause);
        else resolve();
      };
      const onHello = () => finish();
      const onClose = () =>
        finish(
          new Error(
            "Die Direktverbindung wurde vor dem Sync-Handshake beendet.",
          ),
        );
      const timeout = globalThis.setTimeout(
        () =>
          finish(
            new Error(
              "Das verbundene Gerät hat den Sync-Handshake nicht bestätigt.",
            ),
          ),
        timeoutMs,
      );
      waiters.add(onHello);
      connection.channel.addEventListener("close", onClose);
      if (this.peerHelloChannels.has(connection.channel)) finish();
    });
  }

  private markPeerHello(channel: RTCDataChannel): void {
    this.peerHelloChannels.add(channel);
    const waiters = this.peerHelloWaiters.get(channel);
    if (!waiters) return;
    this.peerHelloWaiters.delete(channel);
    for (const resolve of [...waiters]) resolve();
  }

  private async acceptMutationChunk(
    message: Extract<
      ReturnType<typeof localPeerMessageSchema.parse>,
      { kind: "LOCAL_SYNC_MUTATION_CHUNK" }
    >,
  ): Promise<PeerMutation | null> {
    if (
      message.chunkCount !==
      Math.ceil(message.byteSize / localPeerMutationChunkBytes)
    ) {
      throw new Error("Die Anzahl der Änderungsteile ist ungültig.");
    }
    let incoming = this.incomingMutations.get(message.mutationId);
    if (!incoming) {
      if (this.incomingMutations.size >= 16) {
        throw new Error("Zu viele unvollständige Änderungen empfangen.");
      }
      incoming = {
        sha256: message.sha256,
        byteSize: message.byteSize,
        chunkCount: message.chunkCount,
        chunks: new Map(),
      };
      this.incomingMutations.set(message.mutationId, incoming);
    }
    if (
      incoming.sha256 !== message.sha256 ||
      incoming.byteSize !== message.byteSize ||
      incoming.chunkCount !== message.chunkCount
    ) {
      this.incomingMutations.delete(message.mutationId);
      throw new Error("Widersprüchliche Änderungsteile empfangen.");
    }
    const bytes = base64ToBytes(message.dataBase64);
    const expectedBytes = Math.min(
      localPeerMutationChunkBytes,
      message.byteSize - message.index * localPeerMutationChunkBytes,
    );
    if (bytes.byteLength !== expectedBytes) {
      this.incomingMutations.delete(message.mutationId);
      throw new Error("Ein Änderungsteil hat die falsche Größe.");
    }
    const existing = incoming.chunks.get(message.index);
    if (
      existing &&
      (existing.byteLength !== bytes.byteLength ||
        existing.some((byte, index) => byte !== bytes[index]))
    ) {
      this.incomingMutations.delete(message.mutationId);
      throw new Error("Ein Änderungsteil wurde widersprüchlich wiederholt.");
    }
    incoming.chunks.set(message.index, bytes);
    if (incoming.chunks.size !== incoming.chunkCount) return null;
    this.incomingMutations.delete(message.mutationId);
    const complete = new Uint8Array(incoming.byteSize);
    for (let index = 0; index < incoming.chunkCount; index += 1) {
      const chunk = incoming.chunks.get(index);
      if (!chunk) throw new Error("Ein Änderungsteil fehlt.");
      complete.set(chunk, index * localPeerMutationChunkBytes);
    }
    if ((await sha256Hex(complete)) !== incoming.sha256) {
      throw new Error("Die übertragene Änderung ist beschädigt.");
    }
    const mutation = peerMutationSchema.parse(
      JSON.parse(new TextDecoder().decode(complete)),
    );
    if (mutation.mutationId !== message.mutationId) {
      throw new Error("Die übertragene Änderungs-ID stimmt nicht überein.");
    }
    return mutation;
  }

  async sendOutbox(connection: DirectConnection): Promise<number> {
    const mutations = await this.authority.listOutbox();
    await this.sendMutations(connection, mutations);
    return mutations.length;
  }

  async sendMediaInventory(connection: DirectConnection): Promise<number> {
    if (!this.media) return 0;
    const inventory = await this.media.peerMediaInventory(
      localPeerMediaChunkBytes,
    );
    for (const media of batch(inventory, 100)) {
      await this.send(connection, {
        kind: "LOCAL_SYNC_MEDIA_INVENTORY",
        version: localPeerProtocolVersion,
        media,
      });
    }
    return inventory.length;
  }

  private async sendMediaChunks(
    connection: DirectConnection,
    descriptor: LocalPeerMediaDescriptor,
    indices: readonly number[],
  ): Promise<void> {
    if (!this.media) return;
    const stored = await this.media.peerMediaBytes(descriptor.mediaId);
    if (
      !stored ||
      stored.sha256 !== descriptor.sha256 ||
      stored.bytes.byteLength !== descriptor.byteSize
    ) {
      return;
    }
    for (const index of indices) {
      if (index < 0 || index >= descriptor.chunkCount) continue;
      await waitForBackpressure(connection.channel);
      const bytes = stored.bytes.subarray(
        index * localPeerMediaChunkBytes,
        (index + 1) * localPeerMediaChunkBytes,
      );
      await this.send(connection, {
        kind: "LOCAL_SYNC_MEDIA_CHUNK",
        version: localPeerProtocolVersion,
        ...descriptor,
        index,
        dataBase64: bytesToBase64(bytes),
      });
    }
  }

  private async sendMissing(
    connection: DirectConnection,
    watermarks: ReplicaWatermarks,
  ): Promise<void> {
    const missing = (await this.authority.listMutationJournal()).filter(
      (mutation) =>
        mutation.originSequence > (watermarks[mutation.originDeviceId] ?? 0),
    );
    await this.sendMutations(connection, missing);
  }

  private async receive(
    connection: DirectConnection,
    raw: unknown,
  ): Promise<void> {
    const text =
      typeof raw === "string"
        ? raw
        : new TextDecoder().decode(raw as ArrayBuffer);
    const parsed = JSON.parse(text) as unknown;
    const result = localPeerMessageSchema.safeParse(parsed);
    if (!result.success) {
      if (
        parsed &&
        typeof parsed === "object" &&
        "kind" in parsed &&
        typeof parsed.kind === "string" &&
        parsed.kind.startsWith("LOCAL_SYNC_") &&
        "version" in parsed &&
        parsed.version !== localPeerProtocolVersion
      ) {
        throw new Error(
          `Die verbundenen Geräte verwenden unterschiedliche Sync-Versionen (erwartet ${localPeerProtocolVersion}). Bitte aktualisiere beide Apps.`,
        );
      }
      if (this.onUnknown) await this.onUnknown(parsed);
      return;
    }
    const message = result.data;
    if (message.kind === "LOCAL_SYNC_HELLO") {
      if (typeof document !== "undefined") {
        publishDirectPeerDeviceId(message.deviceId);
      }
      await this.onPeerIdentity?.({
        deviceId: message.deviceId,
        publicKey: message.publicKey,
      });
      this.markPeerHello(connection.channel);
      if (message.libraryEmpty && (await this.isLibraryEmpty?.())) {
        const accepted = await this.authority.acceptEmptyLibraryCheckpoint(
          message.watermarks,
        );
        if (!accepted) {
          await this.sendMissing(connection, message.watermarks);
          return;
        }
        await this.send(connection, {
          kind: "LOCAL_SYNC_EMPTY_LIBRARY_CHECKPOINT",
          version: localPeerProtocolVersion,
          acceptedWatermarks: message.watermarks,
        });
        return;
      }
      await this.sendMissing(connection, message.watermarks);
      return;
    }
    if (message.kind === "LOCAL_SYNC_EMPTY_LIBRARY_CHECKPOINT") {
      await this.authority.acknowledgeOutboxThrough(message.acceptedWatermarks);
      await this.onOutboxAcknowledged?.();
      return;
    }
    if (message.kind === "LOCAL_SYNC_ACK") {
      await this.authority.acknowledgeOutbox(message.mutationIds);
      await this.onOutboxAcknowledged?.();
      return;
    }
    if (message.kind === "LOCAL_SYNC_MUTATION_CHUNK") {
      const mutation = await this.acceptMutationChunk(message);
      if (!mutation) return;
      await this.authority.applyRemoteMutations([mutation]);
      await this.send(connection, {
        kind: "LOCAL_SYNC_ACK",
        version: localPeerProtocolVersion,
        mutationIds: [mutation.mutationId],
      });
      await this.onChanged();
      return;
    }
    if (message.kind === "LOCAL_SYNC_MEDIA_INVENTORY") {
      if (!this.media) return;
      for (const descriptor of message.media) {
        const missing = await this.media.peerMediaMissingChunks(descriptor);
        for (const indices of batch(missing, 256)) {
          await this.send(connection, {
            kind: "LOCAL_SYNC_MEDIA_REQUEST",
            version: localPeerProtocolVersion,
            mediaId: descriptor.mediaId,
            sha256: descriptor.sha256,
            indices,
          });
        }
      }
      return;
    }
    if (message.kind === "LOCAL_SYNC_MEDIA_REQUEST") {
      if (!this.media) return;
      const descriptor = (
        await this.media.peerMediaInventory(localPeerMediaChunkBytes)
      ).find(
        (candidate) =>
          candidate.mediaId === message.mediaId &&
          candidate.sha256 === message.sha256,
      );
      if (descriptor) {
        await this.sendMediaChunks(connection, descriptor, message.indices);
      }
      return;
    }
    if (message.kind === "LOCAL_SYNC_MEDIA_CHUNK") {
      if (!this.media) return;
      const complete = await this.media.acceptPeerMediaChunk({
        mediaId: message.mediaId,
        mimeType: message.mimeType,
        sha256: message.sha256,
        byteSize: message.byteSize,
        index: message.index,
        chunkCount: message.chunkCount,
        bytes: base64ToBytes(message.dataBase64),
      });
      if (complete) await this.onChanged();
      return;
    }
    await this.authority.applyRemoteMutations(message.mutations);
    await this.send(connection, {
      kind: "LOCAL_SYNC_ACK",
      version: localPeerProtocolVersion,
      mutationIds: message.mutations.map((mutation) => mutation.mutationId),
    });
    await this.onChanged();
  }
}
