import { describe, expect, it, vi } from "vitest";

import type { PeerMutation } from "@flashcards/domain/device-sync";
import {
  localPeerMessageSchema,
  localPeerProtocolVersion,
} from "@flashcards/domain/local-peer-protocol";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";

import type { DirectConnection } from "./peer";
import { LocalPeerSynchronizer } from "./peer-sync";

class LinkedChannel extends EventTarget {
  readonly sent: string[] = [];
  readyState = "open";
  private amount = 0;
  private threshold = 0;
  peer?: LinkedChannel;

  get bufferedAmount(): number {
    return this.amount;
  }

  set bufferedAmount(value: number) {
    this.amount = value;
  }

  get bufferedAmountLowThreshold(): number {
    return this.threshold;
  }

  set bufferedAmountLowThreshold(value: number) {
    this.threshold = value;
  }

  send(value: string): void {
    this.sent.push(value);
    queueMicrotask(() =>
      this.peer?.dispatchEvent(new MessageEvent("message", { data: value })),
    );
  }
}

class ImmediatelyDrainingChannel extends LinkedChannel {
  private drainingAmount = 2 * 1024 * 1024;
  private drainingThreshold = 0;

  override get bufferedAmount(): number {
    return this.drainingAmount;
  }

  override set bufferedAmount(_value: number) {}

  override get bufferedAmountLowThreshold(): number {
    return this.drainingThreshold;
  }

  override set bufferedAmountLowThreshold(value: number) {
    this.drainingThreshold = value;
    this.drainingAmount = 0;
    this.dispatchEvent(new Event("bufferedamountlow"));
  }
}

const connection = (channel: LinkedChannel): DirectConnection =>
  ({ channel }) as unknown as DirectConnection;

const mutation: PeerMutation = {
  mutationId: "00000000-0000-4000-8000-000000000401",
  entityId: "00000000-0000-4000-8000-000000000402",
  entityType: "DECK",
  operation: "UPSERT",
  originDeviceId: "00000000-0000-4000-8000-000000000403",
  originSequence: 1,
  modifiedAt: "2026-08-09T17:00:00.000Z",
  baseVersion: null,
  resultVersion: 1,
  payloadHash: "a".repeat(64),
  payload: { title: "Direkt" },
};

describe("local peer synchronizer", () => {
  it("announces the durable public key and reports the peer identity", async () => {
    const channel = new LinkedChannel();
    const peerIdentity = vi.fn();
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const sync = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
      undefined,
      undefined,
      undefined,
      "local-public-key-value-that-is-long-enough",
      peerIdentity,
    );

    await sync.announce(connection(channel));
    expect(JSON.parse(channel.sent[0]!)).toMatchObject({
      kind: "LOCAL_SYNC_HELLO",
      publicKey: "local-public-key-value-that-is-long-enough",
    });

    const hello = {
      kind: "LOCAL_SYNC_HELLO",
      version: localPeerProtocolVersion,
      deviceId: "00000000-0000-4000-8000-000000000405",
      publicKey: "peer-public-key-value-that-is-long-enough",
      watermarks: {},
      libraryEmpty: false,
    } as const;
    expect(localPeerMessageSchema.safeParse(hello).success).toBe(true);
    sync.listen(connection(channel));
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(hello),
      }),
    );
    await sync.whenIdle();
    expect(peerIdentity).toHaveBeenCalledWith({
      deviceId: "00000000-0000-4000-8000-000000000405",
      publicKey: "peer-public-key-value-that-is-long-enough",
    });
  });

  it("prioritizes a webstack offer over deferred deck and media synchronization", async () => {
    const channel = new LinkedChannel();
    const applied: string[] = [];
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: vi.fn(async () => applied.push("mutation")),
    } as unknown as LocalAuthorityRepository;
    const handoff = vi.fn(async () => {
      applied.push("webstack");
    });
    const sync = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
      handoff,
    );

    sync.listen(connection(channel), { deferLocalMessages: true });
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_MUTATIONS",
          version: localPeerProtocolVersion,
          mutations: [mutation],
        }),
      }),
    );
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ kind: "WEBSTACK_OFFER", version: 1 }),
      }),
    );
    await sync.whenIdle();

    expect(applied).toEqual(["webstack"]);
    sync.resumeLocalMessages();
    await sync.whenIdle();
    expect(applied).toEqual(["webstack", "mutation"]);
  });

  it("drops only unacknowledged deferred messages from a failed connection", async () => {
    const channel = new LinkedChannel();
    const directConnection = connection(channel);
    const apply = vi.fn();
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: apply,
    } as unknown as LocalAuthorityRepository;
    const sync = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
    );

    sync.listen(directConnection, { deferLocalMessages: true });
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_MUTATIONS",
          version: localPeerProtocolVersion,
          mutations: [mutation],
        }),
      }),
    );
    sync.discardDeferredMessages(directConnection);
    sync.resumeLocalMessages();
    await sync.whenIdle();

    expect(apply).not.toHaveBeenCalled();
  });

  it("exchanges missing journal mutations and acknowledges the durable outbox", async () => {
    const channelA = new LinkedChannel();
    const channelB = new LinkedChannel();
    channelA.peer = channelB;
    channelB.peer = channelA;
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    const apply = vi.fn().mockResolvedValue({ [mutation.originDeviceId]: 1 });
    const changed = vi.fn();
    const authorityA = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([mutation]),
      listOutbox: vi.fn().mockResolvedValue([mutation]),
      acknowledgeOutbox: acknowledge,
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const authorityB = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: apply,
    } as unknown as LocalAuthorityRepository;
    const syncA = new LocalPeerSynchronizer(
      authorityA,
      mutation.originDeviceId,
      vi.fn(),
    );
    const syncB = new LocalPeerSynchronizer(
      authorityB,
      "00000000-0000-4000-8000-000000000404",
      changed,
    );

    syncA.listen(connection(channelA));
    syncB.listen(connection(channelB));
    await Promise.all([
      syncA.announce(connection(channelA)),
      syncB.announce(connection(channelB)),
    ]);
    await Promise.all([
      syncA.waitForPeerHello(connection(channelA)),
      syncB.waitForPeerHello(connection(channelB)),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(apply).toHaveBeenCalledWith([mutation]);
    expect(changed).toHaveBeenCalledAfter(apply);
    expect(acknowledge).toHaveBeenCalledWith([mutation.mutationId]);
  });

  it("does not turn outbox acknowledgements into deck-change events", async () => {
    const channel = new LinkedChannel();
    const changed = vi.fn();
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: acknowledge,
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const sync = new LocalPeerSynchronizer(
      authority,
      mutation.originDeviceId,
      changed,
    );
    sync.listen(connection(channel));

    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_ACK",
          version: localPeerProtocolVersion,
          mutationIds: [mutation.mutationId],
        }),
      }),
    );
    await sync.whenIdle();

    expect(acknowledge).toHaveBeenCalledWith([mutation.mutationId]);
    expect(changed).not.toHaveBeenCalled();
  });

  it("retires obsolete histories only after both peers confirm an empty library", async () => {
    const channelA = new LinkedChannel();
    const channelB = new LinkedChannel();
    channelA.peer = channelB;
    channelB.peer = channelA;
    const deviceA = mutation.originDeviceId;
    const deviceB = "00000000-0000-4000-8000-000000000404";
    const acceptA = vi.fn().mockResolvedValue({
      [deviceA]: 75_461,
      [deviceB]: 500,
    });
    const acceptB = vi.fn().mockResolvedValue({
      [deviceA]: 75_461,
      [deviceB]: 500,
    });
    const acknowledgeA = vi.fn().mockResolvedValue(undefined);
    const acknowledgeB = vi.fn().mockResolvedValue(undefined);
    const authorityA = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({ [deviceA]: 75_461 }),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      acknowledgeOutboxThrough: acknowledgeA,
      acceptEmptyLibraryCheckpoint: acceptA,
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const authorityB = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({ [deviceB]: 500 }),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      acknowledgeOutboxThrough: acknowledgeB,
      acceptEmptyLibraryCheckpoint: acceptB,
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const acknowledgedA = vi.fn();
    const acknowledgedB = vi.fn();
    const syncA = new LocalPeerSynchronizer(
      authorityA,
      deviceA,
      vi.fn(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      async () => true,
      acknowledgedA,
    );
    const syncB = new LocalPeerSynchronizer(
      authorityB,
      deviceB,
      vi.fn(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      async () => true,
      acknowledgedB,
    );

    syncA.listen(connection(channelA));
    syncB.listen(connection(channelB));
    await Promise.all([
      syncA.announce(connection(channelA)),
      syncB.announce(connection(channelB)),
    ]);
    await Promise.all([syncA.whenIdle(), syncB.whenIdle()]);
    await Promise.all([syncA.whenIdle(), syncB.whenIdle()]);

    expect(acceptA).toHaveBeenCalledWith({ [deviceB]: 500 });
    expect(acceptB).toHaveBeenCalledWith({ [deviceA]: 75_461 });
    expect(acknowledgeA).toHaveBeenCalledWith({ [deviceA]: 75_461 });
    expect(acknowledgeB).toHaveBeenCalledWith({ [deviceB]: 500 });
    expect(acknowledgedA).toHaveBeenCalledOnce();
    expect(acknowledgedB).toHaveBeenCalledOnce();
  });

  it("does not create an empty-library checkpoint when the local library is not empty", async () => {
    const channel = new LinkedChannel();
    const accept = vi.fn();
    const sendJournal = vi.fn().mockResolvedValue([]);
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: sendJournal,
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      acknowledgeOutboxThrough: vi.fn(),
      acceptEmptyLibraryCheckpoint: accept,
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const sync = new LocalPeerSynchronizer(
      authority,
      mutation.originDeviceId,
      vi.fn(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      async () => false,
    );
    sync.listen(connection(channel));

    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_HELLO",
          version: localPeerProtocolVersion,
          deviceId: "00000000-0000-4000-8000-000000000405",
          watermarks: {},
          libraryEmpty: true,
        }),
      }),
    );
    await sync.whenIdle();

    expect(accept).not.toHaveBeenCalled();
    expect(sendJournal).toHaveBeenCalledOnce();
    expect(channel.sent).toEqual([]);
  });

  it("durably applies ordered mutation batches before a later handoff message", async () => {
    const channel = new LinkedChannel();
    const applied: string[] = [];
    let releaseFirstBatch!: () => void;
    const firstBatchGate = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve;
    });
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: vi.fn(async (mutations: PeerMutation[]) => {
        if (mutations[0]?.originSequence === 1) await firstBatchGate;
        applied.push(String(mutations[0]?.originSequence));
      }),
    } as unknown as LocalAuthorityRepository;
    const handoff = vi.fn(async () => {
      applied.push("handoff");
    });
    const sync = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
      handoff,
    );

    await sync.start(connection(channel));
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_MUTATIONS",
          version: localPeerProtocolVersion,
          mutations: [mutation],
        }),
      }),
    );
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ kind: "WEBSTACK_COMPLETE", version: 1 }),
      }),
    );
    await Promise.resolve();
    expect(handoff).not.toHaveBeenCalled();

    releaseFirstBatch();
    await sync.whenIdle();

    expect(applied).toEqual(["1", "handoff"]);
  });

  it("blocks a webstack handoff after a preceding durable write fails", async () => {
    const channel = new LinkedChannel();
    const failure = new Error("IndexedDB quota exhausted");
    const applyRemoteMutations = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({});
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations,
    } as unknown as LocalAuthorityRepository;
    const handoff = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sync = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
      handoff,
    );
    await sync.start(connection(channel));
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_MUTATIONS",
          version: localPeerProtocolVersion,
          mutations: [mutation],
        }),
      }),
    );
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ kind: "WEBSTACK_COMPLETE", version: 1 }),
      }),
    );

    await expect(sync.whenIdle()).rejects.toThrow("quota exhausted");
    expect(handoff).not.toHaveBeenCalled();
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ kind: "WEBSTACK_COMPLETE", version: 1 }),
      }),
    );
    await expect(sync.whenIdle()).resolves.toBeUndefined();
    expect(handoff).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("resumes requested media chunks separately from metadata mutations", async () => {
    const channelA = new LinkedChannel();
    const channelB = new LinkedChannel();
    channelA.peer = channelB;
    channelB.peer = channelA;
    const mediaId = "00000000-0000-4000-8000-000000000405";
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const descriptor = {
      mediaId,
      mimeType: "audio/mpeg",
      sha256: "b".repeat(64),
      byteSize: bytes.byteLength,
      chunkCount: 1,
    };
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const acceptChunk = vi.fn().mockResolvedValue(true);
    const mediaA = {
      peerMediaInventory: vi.fn().mockResolvedValue([descriptor]),
      peerMediaMissingChunks: vi.fn().mockResolvedValue([]),
      peerMediaBytes: vi.fn().mockResolvedValue({
        mediaId,
        mimeType: descriptor.mimeType,
        sha256: descriptor.sha256,
        bytes,
      }),
      acceptPeerMediaChunk: vi.fn(),
    };
    const mediaB = {
      peerMediaInventory: vi.fn().mockResolvedValue([]),
      peerMediaMissingChunks: vi.fn().mockResolvedValue([0]),
      peerMediaBytes: vi.fn().mockResolvedValue(null),
      acceptPeerMediaChunk: acceptChunk,
    };
    const syncA = new LocalPeerSynchronizer(
      authority,
      mutation.originDeviceId,
      vi.fn(),
      undefined,
      mediaA,
    );
    const syncB = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
      undefined,
      mediaB,
    );

    await syncA.start(connection(channelA));
    await syncB.start(connection(channelB));
    await syncA.sendMediaInventory(connection(channelA));
    for (let index = 0; index < 6; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all([syncA.whenIdle(), syncB.whenIdle()]);

    expect(mediaB.peerMediaMissingChunks).toHaveBeenCalledWith(descriptor);
    expect(acceptChunk).toHaveBeenCalledWith({
      ...descriptor,
      index: 0,
      bytes,
    });
  });

  it("rejects an older local sync generation with an actionable error", async () => {
    const channel = new LinkedChannel();
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const sync = new LocalPeerSynchronizer(
      authority,
      "00000000-0000-4000-8000-000000000404",
      vi.fn(),
      undefined,
      undefined,
      onError,
    );
    sync.listen(connection(channel), { deferLocalMessages: true });

    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          kind: "LOCAL_SYNC_HELLO",
          version: 1,
          deviceId: "00000000-0000-4000-8000-000000000405",
          watermarks: {},
          libraryEmpty: false,
        }),
      }),
    );

    await expect(sync.whenIdle()).resolves.toBeUndefined();
    expect(onError).not.toHaveBeenCalled();

    sync.resumeLocalMessages();
    await expect(sync.whenIdle()).rejects.toThrow(
      "Bitte aktualisiere beide Apps",
    );
    expect(onError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("sends an imported deck outbox in Safari-safe batches while connected", async () => {
    const imported = Array.from({ length: 140 }, (_, index) => ({
      ...mutation,
      mutationId: `00000000-0000-4000-8000-${String(index + 500).padStart(12, "0")}`,
      entityId: `00000000-0000-4000-8000-${String(index + 900).padStart(12, "0")}`,
      originSequence: index + 1,
      payload: { title: `Goethe ${index} ${"Lektion ".repeat(40)}` },
    }));
    const authority = {
      listOutbox: vi.fn().mockResolvedValue(imported),
    } as unknown as LocalAuthorityRepository;
    const channel = new LinkedChannel();
    const sync = new LocalPeerSynchronizer(
      authority,
      mutation.originDeviceId,
      vi.fn(),
    );

    await expect(sync.sendOutbox(connection(channel))).resolves.toBe(140);

    const messages = channel.sent.map(
      (entry) =>
        JSON.parse(entry) as { kind: string; mutations: PeerMutation[] },
    );
    expect(
      messages.every((entry) => entry.kind === "LOCAL_SYNC_MUTATIONS"),
    ).toBe(true);
    expect(messages.flatMap((entry) => entry.mutations)).toHaveLength(140);
    expect(
      Math.max(
        ...channel.sent.map(
          (entry) => new TextEncoder().encode(entry).byteLength,
        ),
      ),
    ).toBeLessThan(48 * 1024 + 1);
  });

  it("continues when Safari drains the send buffer before the low-buffer listener settles", async () => {
    const authority = {
      listOutbox: vi.fn().mockResolvedValue([mutation]),
    } as unknown as LocalAuthorityRepository;
    const channel = new ImmediatelyDrainingChannel();
    const sync = new LocalPeerSynchronizer(
      authority,
      mutation.originDeviceId,
      vi.fn(),
    );

    await expect(sync.sendOutbox(connection(channel))).resolves.toBe(1);
    expect(channel.sent).toHaveLength(1);
  });

  it("chunks and reassembles a single large mutation without blocking later sync", async () => {
    const channelA = new LinkedChannel();
    const channelB = new LinkedChannel();
    channelA.peer = channelB;
    channelB.peer = channelA;
    const largeMutation: PeerMutation = {
      ...mutation,
      mutationId: "00000000-0000-4000-8000-000000001401",
      entityId: "00000000-0000-4000-8000-000000001402",
      payload: { title: "X".repeat(150_000) },
    };
    const apply = vi.fn().mockResolvedValue({
      [largeMutation.originDeviceId]: largeMutation.originSequence,
    });
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    const authorityA = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([largeMutation]),
      acknowledgeOutbox: acknowledge,
      applyRemoteMutations: vi.fn(),
    } as unknown as LocalAuthorityRepository;
    const authorityB = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      listOutbox: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: apply,
    } as unknown as LocalAuthorityRepository;
    const syncA = new LocalPeerSynchronizer(
      authorityA,
      largeMutation.originDeviceId,
      vi.fn(),
    );
    const syncB = new LocalPeerSynchronizer(
      authorityB,
      "00000000-0000-4000-8000-000000001404",
      vi.fn(),
    );
    await syncA.start(connection(channelA));
    await syncB.start(connection(channelB));
    await syncA.sendOutbox(connection(channelA));
    for (let index = 0; index < 12; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all([syncA.whenIdle(), syncB.whenIdle()]);

    expect(apply).toHaveBeenCalledWith([largeMutation]);
    expect(acknowledge).toHaveBeenCalledWith([largeMutation.mutationId]);
    expect(
      channelA.sent.some((entry) =>
        entry.includes('"kind":"LOCAL_SYNC_MUTATION_CHUNK"'),
      ),
    ).toBe(true);
    expect(
      Math.max(
        ...channelA.sent.map(
          (entry) => new TextEncoder().encode(entry).byteLength,
        ),
      ),
    ).toBeLessThanOrEqual(48 * 1024);
  });
});
