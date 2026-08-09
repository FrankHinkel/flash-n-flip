import { createHash, timingSafeEqual } from "node:crypto";

import type {
  CreateRendezvousSession,
  CreateRendezvousSignal,
  RendezvousCompatibility,
  RendezvousProtocolVersion,
  RendezvousRole,
  RendezvousSession,
  RendezvousSignal,
} from "@flashcards/domain/rendezvous";

export const rendezvousSessionTtlMs = 5 * 60 * 1_000;
export const rendezvousMaximumEncryptedPayloadBytes = 49_152;
export const rendezvousMaximumStoredEncryptedPayloadBytes = 64 * 1024 * 1024;
export const rendezvousMaximumSessions = 2_000;
export const rendezvousMaximumSignalsPerSession = 64;
export const rendezvousSupportedProtocolVersions = [
  1,
] as const satisfies readonly RendezvousProtocolVersion[];

type StoredSignal = RendezvousSignal & {
  senderRole: RendezvousRole;
  recipientRole: RendezvousRole;
  byteSize: number;
};

type StoredSession = {
  id: string;
  protocolVersion: RendezvousProtocolVersion;
  state: "CREATED" | "JOINED";
  initiatorCapabilityHash: string;
  joinerCapabilityHash: string;
  expiresAt: Date;
  nextSequence: number;
  signals: StoredSignal[];
};

type RendezvousStoreOptions = {
  now?: () => Date;
  maximumSessions?: number;
  maximumStoredEncryptedPayloadBytes?: number;
};

const storeError = (
  statusCode: number,
  message: string,
): Error & {
  statusCode: number;
} => Object.assign(new Error(message), { statusCode });

const capabilityHash = (capability: string): string =>
  createHash("sha256").update(capability, "utf8").digest("hex");

const hashesMatch = (left: string, right: string): boolean =>
  timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));

const publicSession = (session: StoredSession): RendezvousSession => ({
  id: session.id,
  protocolVersion: session.protocolVersion,
  state: session.state,
  expiresAt: session.expiresAt.toISOString(),
});

const otherRole = (role: RendezvousRole): RendezvousRole =>
  role === "INITIATOR" ? "JOINER" : "INITIATOR";

export class RendezvousStore {
  readonly #sessions = new Map<string, StoredSession>();
  readonly #now: () => Date;
  readonly #maximumSessions: number;
  readonly #maximumStoredEncryptedPayloadBytes: number;
  #storedEncryptedPayloadBytes = 0;

  constructor(options: RendezvousStoreOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#maximumSessions =
      options.maximumSessions ?? rendezvousMaximumSessions;
    this.#maximumStoredEncryptedPayloadBytes =
      options.maximumStoredEncryptedPayloadBytes ??
      rendezvousMaximumStoredEncryptedPayloadBytes;
  }

  compatibility(): RendezvousCompatibility {
    return {
      supportedProtocolVersions: [...rendezvousSupportedProtocolVersions],
      sessionTtlSeconds: rendezvousSessionTtlMs / 1_000,
      maximumEncryptedPayloadBytes: rendezvousMaximumEncryptedPayloadBytes,
    };
  }

  cleanup(): void {
    const now = this.#now().getTime();
    for (const [id, session] of this.#sessions) {
      if (session.expiresAt.getTime() <= now) this.#deleteSession(id, session);
    }
  }

  create(input: CreateRendezvousSession): RendezvousSession {
    this.cleanup();
    if (this.#sessions.has(input.id)) {
      throw storeError(409, "Rendezvous session already exists");
    }
    if (this.#sessions.size >= this.#maximumSessions) {
      throw storeError(503, "Rendezvous capacity is temporarily exhausted");
    }
    const protocolVersion = [...rendezvousSupportedProtocolVersions]
      .reverse()
      .find((version) => input.supportedProtocolVersions.includes(version));
    if (!protocolVersion) {
      throw storeError(426, "Rendezvous protocol upgrade required");
    }
    const now = this.#now();
    const session: StoredSession = {
      id: input.id,
      protocolVersion,
      state: "CREATED",
      initiatorCapabilityHash: input.initiatorCapabilityHash,
      joinerCapabilityHash: input.joinerCapabilityHash,
      expiresAt: new Date(now.getTime() + rendezvousSessionTtlMs),
      nextSequence: 1,
      signals: [],
    };
    this.#sessions.set(session.id, session);
    return publicSession(session);
  }

  authorize(
    sessionId: string,
    capability: string,
  ): {
    session: StoredSession;
    role: RendezvousRole;
  } {
    this.cleanup();
    const session = this.#sessions.get(sessionId);
    if (!session) throw storeError(404, "Rendezvous session not found");
    const presentedHash = capabilityHash(capability);
    if (hashesMatch(presentedHash, session.initiatorCapabilityHash)) {
      return { session, role: "INITIATOR" };
    }
    if (hashesMatch(presentedHash, session.joinerCapabilityHash)) {
      return { session, role: "JOINER" };
    }
    throw storeError(404, "Rendezvous session not found");
  }

  get(sessionId: string, capability: string): RendezvousSession {
    return publicSession(this.authorize(sessionId, capability).session);
  }

  join(sessionId: string, capability: string): RendezvousSession {
    const authorized = this.authorize(sessionId, capability);
    if (authorized.role !== "JOINER") {
      throw storeError(403, "Joiner capability required");
    }
    authorized.session.state = "JOINED";
    return publicSession(authorized.session);
  }

  send(
    sessionId: string,
    capability: string,
    input: CreateRendezvousSignal,
  ): RendezvousSignal {
    const authorized = this.authorize(sessionId, capability);
    if (authorized.session.state !== "JOINED") {
      throw storeError(409, "Rendezvous session has not been joined");
    }
    const duplicate = authorized.session.signals.find(
      (signal) => signal.messageId === input.messageId,
    );
    if (duplicate) {
      if (
        duplicate.senderRole !== authorized.role ||
        duplicate.encryptedPayload !== input.encryptedPayload
      ) {
        throw storeError(409, "Rendezvous message identifier conflict");
      }
      return this.#publicSignal(duplicate);
    }
    if (
      authorized.session.signals.length >= rendezvousMaximumSignalsPerSession
    ) {
      throw storeError(429, "Rendezvous signal limit reached");
    }
    const byteSize = Buffer.byteLength(input.encryptedPayload, "base64url");
    if (
      this.#storedEncryptedPayloadBytes + byteSize >
      this.#maximumStoredEncryptedPayloadBytes
    ) {
      throw storeError(
        503,
        "Rendezvous signal capacity is temporarily exhausted",
      );
    }
    const signal: StoredSignal = {
      ...input,
      sequence: authorized.session.nextSequence++,
      createdAt: this.#now().toISOString(),
      senderRole: authorized.role,
      recipientRole: otherRole(authorized.role),
      byteSize,
    };
    authorized.session.signals.push(signal);
    this.#storedEncryptedPayloadBytes += byteSize;
    return this.#publicSignal(signal);
  }

  list(
    sessionId: string,
    capability: string,
    afterSequence: number,
  ): RendezvousSignal[] {
    const authorized = this.authorize(sessionId, capability);
    return authorized.session.signals
      .filter(
        (signal) =>
          signal.recipientRole === authorized.role &&
          signal.sequence > afterSequence,
      )
      .slice(0, 64)
      .map((signal) => this.#publicSignal(signal));
  }

  complete(sessionId: string, capability: string): void {
    const { session } = this.authorize(sessionId, capability);
    this.#deleteSession(sessionId, session);
  }

  #deleteSession(sessionId: string, session: StoredSession): void {
    this.#storedEncryptedPayloadBytes -= session.signals.reduce(
      (total, signal) => total + signal.byteSize,
      0,
    );
    this.#sessions.delete(sessionId);
  }

  #publicSignal(signal: StoredSignal): RendezvousSignal {
    return {
      messageId: signal.messageId,
      encryptedPayload: signal.encryptedPayload,
      sequence: signal.sequence,
      createdAt: signal.createdAt,
    };
  }
}
