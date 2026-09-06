import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { CloudLibraryBinding } from "@flashcards/domain/cloud-library";
import { createBrowserCloudLibraryBindings } from "./cloud-library-binding";

const candidate = (account = "account-a"): CloudLibraryBinding => ({
  environment: "development", account, phase: "pending",
  root: {
    libraryId: "10000000-0000-4000-8000-000000000001",
    libraryGeneration: "10000000-0000-4000-8000-000000000002",
    protocolVersion: 1, kind: "library-root", deleted: false,
  },
});

describe("browser cloud binding persistence", () => {
  it("retains pending and confirmed bindings across database reopen", async () => {
    const name = `binding-${crypto.randomUUID()}`;
    await createBrowserCloudLibraryBindings(name).reserve(candidate());
    const reopened = createBrowserCloudLibraryBindings(name);
    expect(await reopened.read("development")).toEqual(candidate());
    await reopened.confirm(candidate(),candidate().root);
    expect(await createBrowserCloudLibraryBindings(name).read("development"))
      .toEqual({...candidate(),phase:"bound"});
  });

  it("serializes racing tabs and refuses a second account", async () => {
    const name = `binding-${crypto.randomUUID()}`;
    const a = createBrowserCloudLibraryBindings(name), b = createBrowserCloudLibraryBindings(name);
    const results = await Promise.allSettled([a.reserve(candidate()),b.reserve(candidate("account-b"))]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await a.read("development")).toEqual(await b.read("development"));
  });

  it("separates development and production and retains the old binding after rejection", async () => {
    const bindings = createBrowserCloudLibraryBindings(`binding-${crypto.randomUUID()}`);
    await bindings.reserve(candidate());
    await expect(bindings.reserve(candidate("account-b"))).rejects.toMatchObject({code:"ACCOUNT_MISMATCH"});
    expect(await bindings.read("development")).toEqual(candidate());
    expect(await bindings.read("production")).toBeNull();
    await bindings.reserve({...candidate("account-b"),environment:"production"});
    expect((await bindings.read("production"))?.account).toBe("account-b");
  });

  it("refuses confirmation without the exact pending binding", async () => {
    const bindings = createBrowserCloudLibraryBindings(`binding-${crypto.randomUUID()}`);
    await expect(bindings.confirm(candidate(),candidate().root)).rejects.toMatchObject({code:"LOCAL_BINDING_CHANGED"});
    expect(await bindings.read("development")).toBeNull();
    await bindings.reserve(candidate());
    await expect(bindings.confirm(candidate("account-b"),candidate().root)).rejects.toMatchObject({code:"ACCOUNT_MISMATCH"});
    expect(await bindings.read("development")).toEqual(candidate());
  });
});
