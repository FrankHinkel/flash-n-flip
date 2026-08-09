import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { RendezvousStore, rendezvousSessionTtlMs } from "./rendezvous-store.js";

const initiatorCapability = "i".repeat(43);
const joinerCapability = "j".repeat(43);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const createSession = (store: RendezvousStore) =>
  store.create({
    id: "00000000-0000-4000-8000-000000000010",
    supportedProtocolVersions: [1],
    initiatorCapabilityHash: hash(initiatorCapability),
    joinerCapabilityHash: hash(joinerCapability),
  });

describe("ephemeral accountless rendezvous store", () => {
  it("negotiates one shared protocol and authorizes independent roles", () => {
    const store = new RendezvousStore();
    expect(createSession(store).protocolVersion).toBe(1);
    expect(
      store.join("00000000-0000-4000-8000-000000000010", joinerCapability)
        .state,
    ).toBe("JOINED");
    expect(() =>
      store.get("00000000-0000-4000-8000-000000000010", "x".repeat(43)),
    ).toThrow("not found");
  });

  it("delivers only to the other role and makes retries idempotent", () => {
    const store = new RendezvousStore();
    createSession(store);
    store.join("00000000-0000-4000-8000-000000000010", joinerCapability);
    const input = {
      messageId: "00000000-0000-4000-8000-000000000011",
      encryptedPayload: "opaque_ciphertext",
    };
    const first = store.send(
      "00000000-0000-4000-8000-000000000010",
      initiatorCapability,
      input,
    );
    const retried = store.send(
      "00000000-0000-4000-8000-000000000010",
      initiatorCapability,
      input,
    );
    expect(retried.sequence).toBe(first.sequence);
    expect(
      store.list(
        "00000000-0000-4000-8000-000000000010",
        initiatorCapability,
        0,
      ),
    ).toEqual([]);
    expect(
      store.list("00000000-0000-4000-8000-000000000010", joinerCapability, 0),
    ).toEqual([first]);
    expect(() =>
      store.send("00000000-0000-4000-8000-000000000010", joinerCapability, {
        ...input,
        encryptedPayload: "different_ciphertext",
      }),
    ).toThrow("identifier conflict");
  });

  it("does not accept signaling before the invited peer joins", () => {
    const store = new RendezvousStore();
    createSession(store);
    expect(() =>
      store.send("00000000-0000-4000-8000-000000000010", initiatorCapability, {
        messageId: "00000000-0000-4000-8000-000000000014",
        encryptedPayload: "opaque_ciphertext",
      }),
    ).toThrow("has not been joined");
  });

  it("forgets sessions after the hard in-memory TTL", () => {
    let now = new Date("2026-08-09T10:00:00.000Z");
    const store = new RendezvousStore({ now: () => now });
    createSession(store);
    now = new Date(now.getTime() + rendezvousSessionTtlMs);
    expect(() =>
      store.get("00000000-0000-4000-8000-000000000010", initiatorCapability),
    ).toThrow("not found");
  });

  it("rejects unsupported clients and bounded-capacity exhaustion", () => {
    const store = new RendezvousStore({ maximumSessions: 1 });
    expect(() =>
      store.create({
        id: "00000000-0000-4000-8000-000000000012",
        supportedProtocolVersions: [2],
        initiatorCapabilityHash: hash(initiatorCapability),
        joinerCapabilityHash: hash(joinerCapability),
      }),
    ).toThrow("upgrade required");
    createSession(store);
    expect(() =>
      store.create({
        id: "00000000-0000-4000-8000-000000000013",
        supportedProtocolVersions: [1],
        initiatorCapabilityHash: hash("a".repeat(43)),
        joinerCapabilityHash: hash("b".repeat(43)),
      }),
    ).toThrow("capacity");
  });

  it("bounds total encrypted signal memory independently of session count", () => {
    const store = new RendezvousStore({
      maximumStoredEncryptedPayloadBytes: 3,
    });
    createSession(store);
    store.join("00000000-0000-4000-8000-000000000010", joinerCapability);
    expect(() =>
      store.send("00000000-0000-4000-8000-000000000010", initiatorCapability, {
        messageId: "00000000-0000-4000-8000-000000000015",
        encryptedPayload: "YWJjZA",
      }),
    ).toThrow("signal capacity");
  });
});
