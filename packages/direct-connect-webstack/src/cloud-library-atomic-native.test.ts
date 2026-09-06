import { describe, expect, it, vi } from "vitest";
import { createNativeAtomicCloudStore, type NativeAtomicCloudPlugin } from "./cloud-library-atomic-native";
import { cloudLibraryZoneName } from "@flashcards/sync/cloud-library-atomic";
const identity = { libraryId: "00000000-0000-4000-8000-000000000001", libraryGeneration: "00000000-0000-4000-8000-000000000002" };
const bridge = (): NativeAtomicCloudPlugin => ({ createLibraryZone: vi.fn(async () => ({ created: true })),
  readZoneRecord: vi.fn(async () => ({ record: null })), atomicRecords: vi.fn(async () => ({ committed: true })) });
describe("native atomic cloud bridge", () => {
  it("pins operations to the original account and exact custom zone without recreating it", async () => {
    const native = bridge(), store = createNativeAtomicCloudStore("a", identity, native);
    await store.atomic([{ kind: "save", name: "root", expectedTag: "old", value: { safe: true } }]);
    expect(native.atomicRecords).toHaveBeenCalledWith({ accountToken: "a", zoneName: cloudLibraryZoneName(identity),
      operations: [{ kind: "save", name: "root", expectedTag: "old", payload: '{"safe":true}' }] });
    expect(native.createLibraryZone).not.toHaveBeenCalled();
  });
  it("requires explicit creation and confirmed commits, preserving account/conflict failures", async () => {
    const native = bridge(), store = createNativeAtomicCloudStore("a", identity, native);
    await store.createZone(); expect(native.createLibraryZone).toHaveBeenCalledOnce();
    const ops = [{ kind: "save" as const, name: "root", expectedTag: null, value: {} }];
    vi.mocked(native.atomicRecords).mockResolvedValueOnce({ committed: false });
    await expect(store.atomic(ops)).rejects.toThrow(/not confirmed/);
    vi.mocked(native.atomicRecords).mockRejectedValueOnce({ code: "WRITE_CONFLICT" });
    await expect(store.atomic(ops)).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
    vi.mocked(native.atomicRecords).mockRejectedValueOnce({ code: "AUTHENTICATION_REQUIRED" });
    await expect(store.atomic(ops)).rejects.toMatchObject({ code: "ACCOUNT_CHANGED" });
  });
});
