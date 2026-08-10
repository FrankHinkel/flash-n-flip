import { describe, expect, it, vi } from "vitest";

import type { PeerMutation } from "@flashcards/domain/device-sync";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";

import type { DirectConnection } from "./peer";
import { LocalPeerSynchronizer } from "./peer-sync";

class LinkedChannel extends EventTarget {
  readyState = "open";
  bufferedAmount = 0;
  bufferedAmountLowThreshold = 0;
  peer?: LinkedChannel;

  send(value: string): void {
    queueMicrotask(() =>
      this.peer?.dispatchEvent(new MessageEvent("message", { data: value })),
    );
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
  it("exchanges missing journal mutations and acknowledges the durable outbox", async () => {
    const channelA = new LinkedChannel();
    const channelB = new LinkedChannel();
    channelA.peer = channelB;
    channelB.peer = channelA;
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    const apply = vi.fn().mockResolvedValue({ [mutation.originDeviceId]: 1 });
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
      vi.fn(),
    );

    await syncA.start(connection(channelA));
    await syncB.start(connection(channelB));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(apply).toHaveBeenCalledWith([mutation]);
    expect(acknowledge).toHaveBeenCalledWith([mutation.mutationId]);
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
          version: 1,
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
    const authority = {
      getReplicaWatermarks: vi.fn().mockResolvedValue({}),
      listMutationJournal: vi.fn().mockResolvedValue([]),
      acknowledgeOutbox: vi.fn(),
      applyRemoteMutations: vi.fn().mockRejectedValue(failure),
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
          version: 1,
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
});
