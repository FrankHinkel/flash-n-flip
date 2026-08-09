import { localPeerMessageSchema } from "@flashcards/domain/local-peer-protocol";
import type { ReplicaWatermarks } from "@flashcards/domain/device-sync";
import type { LocalAuthorityRepository } from "@flashcards/sync/local-authority";

import type { DirectConnection } from "./peer";

const batch = <T>(values: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    result.push(values.slice(index, index + size));
  return result;
};

export class LocalPeerSynchronizer {
  constructor(
    private readonly authority: LocalAuthorityRepository,
    private readonly deviceId: string,
    private readonly onChanged: () => void | Promise<void>,
    private readonly onUnknown?: (value: unknown) => void | Promise<void>,
  ) {}

  private send(connection: DirectConnection, message: unknown): void {
    if (connection.channel.readyState !== "open")
      throw new Error("Direktverbindung ist nicht geöffnet.");
    connection.channel.send(JSON.stringify(message));
  }

  async start(connection: DirectConnection): Promise<void> {
    connection.channel.addEventListener("message", (event) => {
      void this.receive(connection, event.data).catch((cause) => {
        console.error("Local peer synchronization failed", cause);
      });
    });
    this.send(connection, {
      kind: "LOCAL_SYNC_HELLO",
      version: 1,
      deviceId: this.deviceId,
      watermarks: await this.authority.getReplicaWatermarks(),
    });
  }

  async sendPending(connection: DirectConnection): Promise<number> {
    // A new peer may not have mutations that were already acknowledged by a
    // different peer. Sending the journal (duplicates are idempotent) avoids
    // origin-sequence gaps during bootstrap.
    const mutations = await this.authority.listMutationJournal();
    for (const mutationsBatch of batch(mutations, 100)) {
      this.send(connection, {
        kind: "LOCAL_SYNC_MUTATIONS",
        version: 1,
        mutations: mutationsBatch,
      });
    }
    return mutations.length;
  }

  private async sendMissing(
    connection: DirectConnection,
    watermarks: ReplicaWatermarks,
  ): Promise<void> {
    const missing = (await this.authority.listMutationJournal()).filter(
      (mutation) =>
        mutation.originSequence > (watermarks[mutation.originDeviceId] ?? 0),
    );
    for (const mutations of batch(missing, 100)) {
      this.send(connection, {
        kind: "LOCAL_SYNC_MUTATIONS",
        version: 1,
        mutations,
      });
    }
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
    await this.authority.applyRemoteMutations(message.mutations);
    this.send(connection, {
      kind: "LOCAL_SYNC_ACK",
      version: 1,
      mutationIds: message.mutations.map((mutation) => mutation.mutationId),
    });
    await this.onChanged();
  }
}
