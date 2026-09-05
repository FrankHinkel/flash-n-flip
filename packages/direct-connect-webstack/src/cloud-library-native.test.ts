import { describe, expect, it, vi } from "vitest";
import {
  createNativeCloudLibraryStore,
  nativeCloudLibraryAvailable,
} from "./cloud-library-native";
import type { NativeCloudLibraryPlugin } from "./cloud-library-native";

const bridge = (): NativeCloudLibraryPlugin => ({
  accountStatus: vi.fn(async () => ({ accountToken: "account-a" })),
  readRecord: vi.fn(async () => ({
    record: { payload: '{"v":1}', changeTag: "tag" },
  })),
  compareAndSwap: vi.fn(async () => ({
    record: { payload: '{"v":1}', changeTag: "tag2" },
  })),
});

describe("native cloud library bridge contract", () => {
  it("does not enable the native feature in a browser", () => {
    expect(nativeCloudLibraryAvailable()).toBe(false);
  });

  it("pins every operation to the original account and preserves change tags", async () => {
    const native = bridge();
    const store = createNativeCloudLibraryStore("account-a", native);
    await expect(store.read("review.id")).resolves.toEqual({
      value: { v: 1 },
      changeTag: "tag",
    });
    expect(native.readRecord).toHaveBeenCalledWith({
      accountToken: "account-a",
      recordName: "review.id",
    });
    await store.compareAndSwap("review.id", "tag", { v: 1 });
    expect(native.compareAndSwap).toHaveBeenCalledWith({
      accountToken: "account-a",
      recordName: "review.id",
      expectedTag: "tag",
      payload: '{"v":1}',
    });
    await store.compareAndSwap("review.id", null, { v: 1 });
    expect(
      vi.mocked(native.compareAndSwap).mock.lastCall?.[0],
    ).not.toHaveProperty("expectedTag");
  });

  it("does not convert native service failure into missing data", async () => {
    const native = bridge();
    vi.mocked(native.readRecord).mockRejectedValue({
      code: "SERVICE_UNAVAILABLE",
    });
    await expect(
      createNativeCloudLibraryStore("account-a", native).read("review.id"),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("maps account and write conflicts to shared retry semantics", async () => {
    const native = bridge();
    const store = createNativeCloudLibraryStore("account-a", native);
    vi.mocked(native.compareAndSwap).mockRejectedValueOnce({
      code: "WRITE_CONFLICT",
    });
    await expect(
      store.compareAndSwap("review.id", "tag", {}),
    ).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
    vi.mocked(native.readRecord).mockRejectedValueOnce({
      code: "ACCOUNT_CHANGED",
    });
    await expect(store.read("review.id")).rejects.toMatchObject({
      code: "ACCOUNT_CHANGED",
    });
  });

  it("requires explicit null for a missing record and a tag for successful responses", async () => {
    const native = bridge();
    const store = createNativeCloudLibraryStore("account-a", native);
    vi.mocked(native.readRecord).mockResolvedValueOnce({ record: null });
    await expect(store.read("review.id")).resolves.toBeNull();
    vi.mocked(native.readRecord).mockResolvedValueOnce({
      record: { payload: "{}", changeTag: "" },
    });
    await expect(store.read("review.id")).rejects.toThrow("invalid record");
  });
});
