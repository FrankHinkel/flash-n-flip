import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { CloudLibraryBinding } from "@flashcards/domain/cloud-library";
import {
  createBrowserCloudKeyValue, createNativeCloudKeyValue,
  createNativeCloudLibraryBindings, createCloudAssetStaging,
} from "./cloud-library-storage";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const binding = (): CloudLibraryBinding => ({ environment: "development", account: "account-a", phase: "pending",
  root: { kind: "library-root", protocolVersion: 1, libraryId: id(1), libraryGeneration: id(2), deleted: false } });
const scope = () => ({ environment: "development" as const, account: "account-a",
  identity: { libraryId: id(1), libraryGeneration: id(2) },
  manifest: { sha256: "a".repeat(64), byteSize: 3, chunks: [{ index: 0, sha256: "b".repeat(64), byteSize: 3 }] } });

function nativeFixture() {
  let committed = new Map<string, string>();
  let working: Map<string, string> | null = null;
  let failCommit = false;
  const sqlite = {
    createConnection: vi.fn(async () => undefined), isDBOpen: vi.fn(async () => ({ result: true })),
    open: vi.fn(async () => undefined), execute: vi.fn(async () => ({})),
    isTransactionActive: vi.fn(async () => ({ result: working !== null })),
    beginTransaction: vi.fn(async () => { working = new Map(committed); return {}; }),
    commitTransaction: vi.fn(async () => {
      if (failCommit) throw new Error("interrupted commit");
      committed = working!; working = null; return {};
    }),
    rollbackTransaction: vi.fn(async () => { working = null; return {}; }),
    query: vi.fn(async (input: { values: string[] }) => {
      const value = (working ?? committed).get(input.values[0]!);
      return { values: [{ ios_columns: ["entry_value"] }, ...(value === undefined ? [] : [{ entry_value: value }])] };
    }),
    run: vi.fn(async (input: { values: string[] }) => { working!.set(input.values[0]!, input.values[1]!); return {}; }),
  };
  return { sqlite: sqlite as unknown as NonNullable<Parameters<typeof createNativeCloudKeyValue>[0]>,
    rollback: sqlite.rollbackTransaction, interrupt: (value: boolean) => { failCommit = value; } };
}

describe("durable cloud platform storage", () => {
  it("reopens browser staging without losing interrupted download chunks", async () => {
    const name = crypto.randomUUID();
    const first = createCloudAssetStaging({ ...scope(), values: createBrowserCloudKeyValue(name) });
    await first.writeChunk(0, new Uint8Array([1, 2, 3]));
    const restarted = createCloudAssetStaging({ ...scope(), values: createBrowserCloudKeyValue(name) });
    expect(await restarted.readChunk(0)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("isolates accounts, environments, libraries and generations", async () => {
    const values = createBrowserCloudKeyValue(crypto.randomUUID());
    await createCloudAssetStaging({ ...scope(), values }).writeChunk(0, new Uint8Array([1, 2, 3]));
    for (const changes of [
      { account: "account-b" }, { environment: "production" as const },
      { identity: { libraryId: id(99), libraryGeneration: id(2) } },
      { identity: { libraryId: id(1), libraryGeneration: id(99) } },
    ]) expect(await createCloudAssetStaging({ ...scope(), ...changes, values }).readChunk(0)).toBeNull();
  });

  it("rejects bad chunk positions and sizes before writing", async () => {
    const staging = createCloudAssetStaging({ ...scope(), values: createBrowserCloudKeyValue(crypto.randomUUID()) });
    await expect(staging.writeChunk(1, new Uint8Array(3))).rejects.toThrow(/index/);
    await expect(staging.writeChunk(0, new Uint8Array(2))).rejects.toThrow(/size/);
    expect(await staging.readChunk(0)).toBeNull();
  });

  it("serializes browser read-modify-write operations across adapter instances", async () => {
    const name = crypto.randomUUID();
    const a = createBrowserCloudKeyValue(name); const b = createBrowserCloudKeyValue(name);
    await Promise.all(Array.from({ length: 10 }, (_, index) => (index % 2 ? a : b)
      .update("count", (current) => String(Number(current ?? "0") + 1))));
    expect(await a.read("count")).toBe("10");
  });

  it("rolls back browser binding conflicts without changing the durable account", async () => {
    const name = crypto.randomUUID();
    const bindings = createNativeCloudLibraryBindings(createBrowserCloudKeyValue(name));
    const pending = await bindings.reserve(binding()); await bindings.confirm(pending, pending.root);
    await expect(bindings.reserve({ ...binding(), account: "account-b" })).rejects.toThrow("ACCOUNT_MISMATCH");
    const restarted = createNativeCloudLibraryBindings(createBrowserCloudKeyValue(name));
    expect(await restarted.read("development")).toMatchObject({ account: "account-a", phase: "bound" });
    expect(await restarted.read("production")).toBeNull();
  });

  it("keeps SQLite binding and staging across adapter recreation", async () => {
    const fixture = nativeFixture(); const name = crypto.randomUUID();
    const values = createNativeCloudKeyValue(fixture.sqlite, name);
    const bindings = createNativeCloudLibraryBindings(values);
    const pending = await bindings.reserve(binding()); await bindings.confirm(pending, pending.root);
    await createCloudAssetStaging({ ...scope(), values }).writeChunk(0, new Uint8Array([4, 5, 6]));
    const restarted = createNativeCloudKeyValue(fixture.sqlite, name);
    expect(await createNativeCloudLibraryBindings(restarted).read("development")).toMatchObject({ phase: "bound" });
    expect(await createCloudAssetStaging({ ...scope(), values: restarted }).readChunk(0)).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("never reports SQLite success before commit and retries after interruption", async () => {
    const fixture = nativeFixture(); const values = createNativeCloudKeyValue(fixture.sqlite, crypto.randomUUID());
    await values.update("key", () => "old"); fixture.interrupt(true);
    await expect(values.update("key", () => "new")).rejects.toThrow("interrupted commit");
    expect(fixture.rollback).toHaveBeenCalledOnce(); expect(await values.read("key")).toBe("old");
    fixture.interrupt(false); await values.update("key", () => "new");
    expect(await values.read("key")).toBe("new");
  });

  it("rejects native account/generation replacement without erasing the old binding", async () => {
    const fixture = nativeFixture(); const values = createNativeCloudKeyValue(fixture.sqlite, crypto.randomUUID());
    const bindings = createNativeCloudLibraryBindings(values);
    const pending = await bindings.reserve(binding()); await bindings.confirm(pending, pending.root);
    await expect(bindings.confirm(pending, { ...pending.root, libraryGeneration: id(99) })).rejects.toThrow("ROOT_CHANGED");
    await expect(bindings.reserve({ ...binding(), account: "account-b" })).rejects.toThrow("ACCOUNT_MISMATCH");
    expect((await bindings.read("development"))?.root).toEqual(pending.root);
  });
});
