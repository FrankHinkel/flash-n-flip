import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserCloudKeyValue } from "./cloud-library-storage";

const selected = vi.hoisted(() => ({ name: "" }));
vi.mock("./cloud-library-storage", async (load) => {
  const actual = await load<typeof import("./cloud-library-storage")>();
  return {
    ...actual,
    createBrowserCloudKeyValue: () =>
      actual.createBrowserCloudKeyValue(selected.name),
  };
});
import {
  assertPeerLibraryAllowed,
  cloudPolicyKey,
  readCloudPolicy,
  updateCloudPolicy,
  withCloudAuthorityLock,
} from "./cloud-library-policy";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const policy = () => ({
  account: "account-a",
  environment: "development" as const,
  enabled: true,
  blocked: false,
  command: null,
});
const values = () => createBrowserCloudKeyValue();

describe("durable iCloud policy validation and authority fencing", () => {
  beforeEach(() => {
    selected.name = crypto.randomUUID();
  });
  it.each([
    { kind: "deck" },
    {
      kind: "progress",
      deckId: id(1),
      operationId: id(2),
      nextGeneration: "invalid",
    },
    {
      kind: "remove",
      deckId: id(1),
      operationId: id(2),
      nextGeneration: id(3),
      extra: true,
    },
    [],
  ])(
    "rejects malformed deletion intent and preserves its durable record: %j",
    async (command) => {
      const raw = JSON.stringify({ ...policy(), blocked: true, command });
      await values().update(cloudPolicyKey, () => raw);
      await expect(readCloudPolicy()).rejects.toThrow("preserve local data");
      await expect(assertPeerLibraryAllowed()).rejects.toThrow(
        "preserve local data",
      );
      expect(await values().read(cloudPolicyKey)).toBe(raw);
    },
  );
  it("refuses invalid policy writes before changing persistent state", async () => {
    await updateCloudPolicy(policy);
    await expect(
      updateCloudPolicy((current) => ({
        ...current!,
        command: {
          kind: "deck",
          deckId: id(1),
          operationId: "invalid",
          nextGeneration: id(3),
        },
      })),
    ).rejects.toThrow();
    expect(await readCloudPolicy()).toEqual(policy());
  });
  it.each([{ account: "account-b" }, { environment: "production" as const }])(
    "preserves the linked authority after an account or environment change: %j",
    async (change) => {
      await updateCloudPolicy(policy);
      await expect(
        updateCloudPolicy((current) => ({ ...current!, ...change })),
      ).rejects.toThrow("binding changed");
      expect(await readCloudPolicy()).toEqual(policy());
    },
  );
  it("keeps peer writes fenced after disabling iCloud and reopening storage", async () => {
    await updateCloudPolicy(policy);
    await updateCloudPolicy((current) => ({ ...current!, enabled: false }));
    await expect(assertPeerLibraryAllowed()).rejects.toThrow("Direktabgleich");
    expect(JSON.parse((await values().read(cloudPolicyKey))!).enabled).toBe(
      false,
    );
  });
  it("serializes concurrent updates without losing deletion intent", async () => {
    await updateCloudPolicy(policy);
    await Promise.all([
      updateCloudPolicy((current) => ({
        ...current!,
        blocked: true,
        command: {
          kind: "deck",
          deckId: id(1),
          operationId: id(2),
          nextGeneration: id(3),
        },
      })),
      updateCloudPolicy((current) => ({ ...current!, enabled: false })),
    ]);
    expect(await readCloudPolicy()).toMatchObject({
      blocked: true,
      enabled: false,
      command: { operationId: id(2) },
    });
  });
  it("releases the serialization lock after a rejected operation", async () => {
    await expect(
      withCloudAuthorityLock(async () => {
        throw new Error("interrupted");
      }),
    ).rejects.toThrow("interrupted");
    await expect(updateCloudPolicy(policy)).resolves.toBeUndefined();
  });
  it.each([
    "{",
    "null",
    JSON.stringify({ ...policy(), account: " " }),
    " ".repeat(4097),
    JSON.stringify({ ...policy(), account: "界".repeat(1024) }) +
      " ".repeat(1100),
  ])("fails closed for unreadable persistent policies", async (raw) => {
    await values().update(cloudPolicyKey, () => raw);
    await expect(readCloudPolicy()).rejects.toThrow("preserve local data");
    expect(await values().read(cloudPolicyKey)).toBe(raw);
  });
});
