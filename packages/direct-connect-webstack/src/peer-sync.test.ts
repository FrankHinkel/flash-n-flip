import { describe, expect, it, vi } from "vitest";

import type { PeerMutation } from "@flashcards/domain/device-sync";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";

import type { DirectConnection } from "./peer";
import { LocalPeerSynchronizer } from "./peer-sync";

class LinkedChannel extends EventTarget {
  readyState = "open";
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
});
