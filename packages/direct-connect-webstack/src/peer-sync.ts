import { localPeerMessageSchema } from "@flashcards/domain/local-peer-protocol";
import type { ReplicaWatermarks } from "@flashcards/domain/device-sync";
import type { PeerMutation } from "@flashcards/domain/device-sync";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";

import type { DirectConnection } from "./peer";
import type { LocalAppRepository, LocalPeerMediaDescriptor } from "./local-app";

export const localPeerMediaChunkBytes = 24 * 1024;
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
  if (channel.bufferedAmount < 1024 * 1024) return;
  channel.bufferedAmountLowThreshold = 256 * 1024;
  await new Promise<void>((resolve) =>
    channel.addEventListener("bufferedamountlow", () => resolve(), {
      once: true,
    }),
  );
};

const mutationBatches = (
  mutations: readonly PeerMutation[],
): PeerMutation[][] => {
  const result: PeerMutation[][] = [];
  let current: PeerMutation[] = [];
  const byteSize = (entries: readonly PeerMutation[]) =>
    new TextEncoder().encode(
      JSON.stringify({
        kind: "LOCAL_SYNC_MUTATIONS",
        version: 1,
        mutations: entries,
      }),
    ).byteLength;
  for (const mutation of mutations) {
    const candidate = [...current, mutation];
    if (
      candidate.length <= 100 &&
      byteSize(candidate) <= localPeerMaximumMessageBytes
    ) {
      current = candidate;
      continue;
    }
    if (
      !current.length ||
      byteSize([mutation]) > localPeerMaximumMessageBytes
    ) {
      throw new Error(
        `Lokale Änderung ${mutation.mutationId} ist zu groß für den Direktabgleich.`,
      );
    }
    result.push(current);
    current = [mutation];
  }
  if (current.length) result.push(current);
  return result;
};

export class LocalPeerSynchronizer {
  private messageTail: Promise<void> = Promise.resolve();
  private readonly listeningChannels = new WeakSet<RTCDataChannel>();
  private deferLocalMessages = false;
  private readonly deferredLocalMessages: Array<{
    connection: DirectConnection;
    data: unknown;
  }> = [];

  constructor(
    private readonly authority: LocalAuthorityRepository,
    private readonly deviceId: string,
    private readonly onChanged: () => void | Promise<void>,
    private readonly onUnknown?: (value: unknown) => void | Promise<void>,
    private readonly media?: LocalPeerMediaSync,
  ) {}

  private async send(
    connection: DirectConnection,
    message: unknown,
  ): Promise<void> {
    if (connection.channel.readyState !== "open")
      throw new Error("Direktverbindung ist nicht geöffnet.");
    await waitForBackpressure(connection.channel);
    connection.channel.send(JSON.stringify(message));
  }

  private async sendMutations(
    connection: DirectConnection,
    mutations: readonly PeerMutation[],
  ): Promise<void> {
    for (const entries of mutationBatches(mutations)) {
      await this.send(connection, {
        kind: "LOCAL_SYNC_MUTATIONS",
        version: 1,
        mutations: entries,
      });
    }
  }

  listen(
    connection: DirectConnection,
    options: { deferLocalMessages?: boolean } = {},
  ): void {
    this.deferLocalMessages = Boolean(options.deferLocalMessages);
    if (this.listeningChannels.has(connection.channel)) return;
    this.listeningChannels.add(connection.channel);
    connection.channel.addEventListener("message", (event) => {
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
      return localPeerMessageSchema.safeParse(JSON.parse(text)).success;
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
      version: 1,
      deviceId: this.deviceId,
      watermarks: await this.authority.getReplicaWatermarks(),
    });
  }

  async start(connection: DirectConnection): Promise<void> {
    this.listen(connection);
    await this.announce(connection);
  }

  async whenIdle(): Promise<void> {
    await this.messageTail;
  }

  async sendPending(connection: DirectConnection): Promise<number> {
    // A new peer may not have mutations that were already acknowledged by a
    // different peer. Sending the journal (duplicates are idempotent) avoids
    // origin-sequence gaps during bootstrap.
    const mutations = await this.authority.listMutationJournal();
    await this.sendMutations(connection, mutations);
    return mutations.length;
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
        version: 1,
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
        version: 1,
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
      if (this.onUnknown) await this.onUnknown(parsed);
      return;
    }
    const message = result.data;
    if (message.kind === "LOCAL_SYNC_HELLO") {
      await this.sendMissing(connection, message.watermarks);
      return;
    }
    if (message.kind === "LOCAL_SYNC_ACK") {
      await this.authority.acknowledgeOutbox(message.mutationIds);
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
            version: 1,
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
      version: 1,
      mutationIds: message.mutations.map((mutation) => mutation.mutationId),
    });
    await this.onChanged();
  }
}
