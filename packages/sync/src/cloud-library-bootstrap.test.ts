import { describe, expect, it, vi } from "vitest";
import type { CloudLibraryBinding, CloudLibraryRoot } from "@flashcards/domain/cloud-library";
import { CloudLibraryError, type CloudRecordStore } from "./cloud-library.js";
import {
  cloudLibraryRootRecordName, connectCloudLibrary,
  confirmCloudLibraryBinding, reserveCloudLibraryBinding,
  type CloudLibraryBindingRepository,
} from "./cloud-library-bootstrap.js";

const root = (digit = "1"): CloudLibraryRoot => ({
  libraryId: `${digit}0000000-0000-4000-8000-000000000001`,
  libraryGeneration: `${digit}0000000-0000-4000-8000-000000000002`,
  protocolVersion: 1, kind: "library-root", deleted: false,
});
function local() {
  let binding: CloudLibraryBinding | null = null;
  const repository: CloudLibraryBindingRepository = {
    read: async () => binding,
    reserve: async (candidate) => binding = reserveCloudLibraryBinding(binding, candidate),
    confirm: async (expected, remote) => { binding = confirmCloudLibraryBinding(binding, expected, remote); },
  };
  return repository;
}
function remote() {
  let value: unknown = null;
  const store: CloudRecordStore = {
    read: vi.fn(async () => value ? {value, changeTag: "tag"} : null),
    compareAndSwap: vi.fn(async (_name, tag, candidate) => {
      if (value || tag !== null) throw new CloudLibraryError("WRITE_CONFLICT", "Already exists");
      value = candidate;
    }),
  };
  return { store, replace: (next: unknown) => { value = next; } };
}
function input(bindings = local(), store = remote().store) {
  return {
    account: "account-a", environment: "development" as const, bindings,
    storeForAccount: vi.fn(() => store),
    assertAccount: vi.fn(async () => undefined),
    randomUUID: () => root().libraryId,
  };
}

describe("durable private library bootstrap", () => {
  it("reserves locally before cloud access and confirms only after readback", async () => {
    const db = remote();
    const options = input(local(), db.store);
    options.storeForAccount.mockImplementation(() => {
      expect(options.bindings.read("development")).resolves.toMatchObject({phase:"pending"});
      return db.store;
    });
    const identity = await connectCloudLibrary(options);
    expect(db.store.compareAndSwap).toHaveBeenCalledWith(cloudLibraryRootRecordName, null, identity);
    expect(await options.bindings.read("development")).toMatchObject({phase:"bound",root:identity});
  });

  it("adopts an existing root without writing over it", async () => {
    const db = remote(); db.replace(root("2"));
    expect(await connectCloudLibrary(input(local(), db.store))).toEqual(root("2"));
    expect(db.store.compareAndSwap).not.toHaveBeenCalled();
  });

  it("converges two independently initialized devices on one root", async () => {
    const db = remote();
    const a = input(local(), db.store), b = input(local(), db.store);
    b.randomUUID = () => root("2").libraryId;
    const [first, second] = await Promise.all([connectCloudLibrary(a),connectCloudLibrary(b)]);
    expect(first).toEqual(second);
    expect(await b.bindings.read("development")).toMatchObject({phase:"bound",root:first});
  });

  it("recovers when a successful create response is lost", async () => {
    const db = remote(); const options = input(local(), db.store);
    const write = db.store.compareAndSwap;
    db.store.compareAndSwap = vi.fn(async (...args) => {
      await write(...args); throw new Error("connection lost after write");
    });
    await expect(connectCloudLibrary(options)).rejects.toThrow("connection lost");
    const pending = await options.bindings.read("development");
    expect(pending?.phase).toBe("pending");
    expect(await connectCloudLibrary(options)).toEqual(pending?.root);
    expect(db.store.compareAndSwap).toHaveBeenCalledTimes(1);
  });

  it("does not recreate a remotely removed confirmed library", async () => {
    const db = remote(); const options = input(local(), db.store);
    await connectCloudLibrary(options); db.replace(null);
    await expect(connectCloudLibrary(options)).rejects.toMatchObject({code:"ROOT_MISSING"});
    expect(db.store.compareAndSwap).toHaveBeenCalledTimes(1);
    expect(await options.bindings.read("development")).toMatchObject({phase:"bound"});
  });

  it("refuses a different account before any remote access", async () => {
    const db = remote(); const options = input(local(), db.store);
    await connectCloudLibrary(options);
    options.storeForAccount.mockClear();
    await expect(connectCloudLibrary({...options, account:"account-b"})).rejects.toMatchObject({code:"ACCOUNT_MISMATCH"});
    expect(options.storeForAccount).not.toHaveBeenCalled();
  });

  it.each([root("2"), {...root(), deleted:true}])("refuses changed or deleted roots", async (changed) => {
    const db = remote(); db.replace(root()); const options = input(local(), db.store);
    await connectCloudLibrary(options); db.replace(changed);
    await expect(connectCloudLibrary(options)).rejects.toMatchObject({
      code: changed.deleted ? "ROOT_DELETED" : "ROOT_CHANGED",
    });
    expect(db.store.compareAndSwap).not.toHaveBeenCalled();
  });

  it("does not treat an outage as an empty cloud", async () => {
    const db = remote(); vi.mocked(db.store.read).mockRejectedValue(new Error("offline"));
    const options = input(local(), db.store);
    await expect(connectCloudLibrary(options)).rejects.toThrow("offline");
    expect(db.store.compareAndSwap).not.toHaveBeenCalled();
    expect(await options.bindings.read("development")).toMatchObject({phase:"pending"});
  });

  it("does not confirm locally when the account changes during remote access", async () => {
    const db = remote(); const options = input(local(), db.store);
    options.assertAccount.mockResolvedValueOnce(undefined).mockRejectedValue(new Error("changed"));
    await expect(connectCloudLibrary(options)).rejects.toThrow("changed");
    expect(await options.bindings.read("development")).toMatchObject({phase:"pending"});
  });

  it("fails on unsupported remote schema without rewriting it", async () => {
    const db = remote(); db.replace({...root(), protocolVersion:2});
    await expect(connectCloudLibrary(input(local(), db.store))).rejects.toThrow();
    expect(db.store.compareAndSwap).not.toHaveBeenCalled();
  });

  it("does not acknowledge local persistence failure as successful linking", async () => {
    const bindings = local();
    bindings.confirm = async () => { throw new Error("disk full"); };
    await expect(connectCloudLibrary(input(bindings))).rejects.toThrow("disk full");
    expect(await bindings.read("development")).toMatchObject({phase:"pending"});
  });
});
