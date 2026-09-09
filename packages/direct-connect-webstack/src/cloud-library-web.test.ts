import { describe, expect, it, vi } from "vitest";
import {
  cloudLibraryRecordType,
  createCloudLibraryWebStore,
  prepareCloudLibraryWeb,
} from "./cloud-library-web";
import type { CloudLibraryWebDatabase } from "./cloud-library-web";

const name = "review.fixture";
const record = (value: unknown = { safe: true }) => ({
  recordName: name,
  recordType: cloudLibraryRecordType,
  recordChangeTag: "tag-1",
  fields: {
    payload: { value: JSON.stringify(value) },
    schemaVersion: { value: 1 },
  },
});
const database = (): CloudLibraryWebDatabase => ({
  fetchRecords: vi.fn(async () => ({ records: [record()] })),
  saveRecords: vi.fn(async () => ({ records: [record()] })),
});

describe("CloudKit JS conditional record adapter", () => {
  it("checks the account before and after every read and write", async () => {
    const guard = vi.fn(async () => undefined);
    const store = createCloudLibraryWebStore(database(), guard);
    await expect(store.read(name)).resolves.toEqual({
      value: { safe: true },
      changeTag: "tag-1",
    });
    await store.compareAndSwap(name, "tag-1", { safe: true });
    expect(guard).toHaveBeenCalledTimes(4);
  });

  it("passes change tags unchanged and uses create-only for new records", async () => {
    const db = database();
    const store = createCloudLibraryWebStore(db, async () => undefined);
    await store.compareAndSwap(name, "tag-original", { safe: true });
    expect(db.saveRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ recordChangeTag: "tag-original" }),
    );
    await store.compareAndSwap(name, null, { safe: true });
    expect(vi.mocked(db.saveRecords).mock.lastCall?.[0]).not.toHaveProperty(
      "recordChangeTag",
    );
  });

  it("does not interpret an outage or partial error as a missing library", async () => {
    const db = database();
    const store = createCloudLibraryWebStore(db, async () => undefined);
    vi.mocked(db.fetchRecords).mockResolvedValueOnce({
      errors: [{ serverErrorCode: "SERVICE_UNAVAILABLE" }],
      records: [],
    });
    await expect(store.read(name)).rejects.toThrow("SERVICE_UNAVAILABLE");
    vi.mocked(db.fetchRecords).mockResolvedValueOnce({ records: [] });
    await expect(store.read(name)).rejects.toThrow("incomplete");
    vi.mocked(db.fetchRecords).mockResolvedValueOnce({
      errors: [
        { serverErrorCode: "UNKNOWN_ITEM" },
        { serverErrorCode: "ACCESS_DENIED" },
      ],
      records: [],
    });
    await expect(store.read(name)).rejects.toThrow();
    vi.mocked(db.fetchRecords).mockResolvedValueOnce({
      records: [{ recordName: name, serverErrorCode: "UNKNOWN_ITEM" }],
    });
    await expect(store.read(name)).resolves.toBeNull();
  });

  it("propagates write conflicts instead of retrying with a newer tag", async () => {
    const db = database();
    vi.mocked(db.saveRecords).mockResolvedValue({
      records: [{ serverErrorCode: "SERVER_RECORD_CHANGED" }],
      hasErrors: true,
    });
    const store = createCloudLibraryWebStore(db, async () => undefined);
    await expect(
      store.compareAndSwap(name, "old-tag", {}),
    ).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
    expect(db.saveRecords).toHaveBeenCalledTimes(1);
  });

  it("normalizes conflicts when the SDK rejects its promise", async () => {
    const db = database();
    vi.mocked(db.saveRecords).mockRejectedValue({
      serverErrorCode: "SERVER_RECORD_CHANGED",
    });
    await expect(
      createCloudLibraryWebStore(db, async () => undefined).compareAndSwap(
        name,
        null,
        {},
      ),
    ).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
  });

  it("refuses operations after account binding fails", async () => {
    const db = database();
    const store = createCloudLibraryWebStore(db, async () => {
      throw new Error("account changed");
    });
    await expect(store.compareAndSwap(name, null, {})).rejects.toThrow(
      "account changed",
    );
    expect(db.saveRecords).not.toHaveBeenCalled();
  });

  it("does not apply or acknowledge a response after an account change", async () => {
    const db = database();
    let checks = 0;
    const store = createCloudLibraryWebStore(db, async () => {
      if (++checks === 2) throw new Error("account changed");
    });
    await expect(store.read(name)).rejects.toThrow("account changed");
  });

  it("rejects wrong record identities and unsupported schema versions", async () => {
    const db = database();
    const store = createCloudLibraryWebStore(db, async () => undefined);
    vi.mocked(db.fetchRecords).mockResolvedValueOnce({
      records: [{ ...record(), recordName: "review.wrong" }],
    });
    await expect(store.read(name)).rejects.toThrow("invalid library record");
    vi.mocked(db.fetchRecords).mockResolvedValueOnce({
      records: [
        {
          ...record(),
          fields: { ...record().fields, schemaVersion: { value: 2 } },
        },
      ],
    });
    await expect(store.read(name)).rejects.toThrow("invalid library record");
  });

  it("requires a complete success response before confirming a write", async () => {
    const db = database();
    vi.mocked(db.saveRecords).mockResolvedValue({
      records: [],
      hasErrors: true,
    });
    await expect(
      createCloudLibraryWebStore(db, async () => undefined).compareAndSwap(
        name,
        null,
        {},
      ),
    ).rejects.toThrow();
  });

  it("rejects unsafe names and oversized metadata before contacting Apple", async () => {
    const db = database();
    const store = createCloudLibraryWebStore(db, async () => undefined);
    await expect(store.read("../record")).rejects.toThrow("record name");
    await expect(
      store.compareAndSwap(name, null, "x".repeat(201 * 1024)),
    ).rejects.toThrow("record limit");
    expect(db.fetchRecords).not.toHaveBeenCalled();
    expect(db.saveRecords).not.toHaveBeenCalled();
  });

  it("does not initialize sign-in without an app-specific configuration", async () => {
    await expect(
      prepareCloudLibraryWeb({
        containerIdentifier: "iCloud.com.flash-n-flip",
        apiToken: "",
        environment: "development",
        signInButtonId: "apple-sign-in",
        signOutButtonId: "apple-sign-out",
      }),
    ).rejects.toThrow("configuration is missing");
  });
});
