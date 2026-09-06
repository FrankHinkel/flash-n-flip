import { describe, expect, it, vi } from "vitest";
import { cloudLibraryZoneName } from "@flashcards/sync/cloud-library-atomic";
import { createWebAtomicCloudStore, type CloudAtomicWebDatabase } from "./cloud-library-atomic-web";
const identity = { libraryId: "00000000-0000-4000-8000-000000000001", libraryGeneration: "00000000-0000-4000-8000-000000000002" };
function fixture() {
  const zone = { zoneID: { zoneName: cloudLibraryZoneName(identity) }, atomic: true };
  const results: object[] = [];
  const batch = {
    create: vi.fn((record) => { results.push({ ...record, recordChangeTag: "saved" }); return batch; }),
    update: vi.fn((record) => { results.push({ ...record, recordChangeTag: "saved" }); return batch; }),
    forceDelete: vi.fn((record) => { results.push({ ...record, deleted: true }); return batch; }),
    commit: vi.fn(async () => ({ records: results })),
  };
  const db = { fetchRecords: vi.fn(async () => ({ records: [{ recordName: "missing", serverErrorCode: "UNKNOWN_ITEM" }] })),
    saveRecords: vi.fn(), fetchRecordZones: vi.fn(async () => ({ zones: [zone] })),
    saveRecordZones: vi.fn(async () => ({ zones: [zone] })), newRecordsBatch: vi.fn(() => batch) };
  const guard = vi.fn(async () => undefined);
  return { db, batch, guard, store: createWebAtomicCloudStore(db as unknown as CloudAtomicWebDatabase, guard, identity) };
}
const operations = [
  { kind: "save" as const, name: "ledger.deck", expectedTag: "old", value: { deleted: true } },
  { kind: "delete" as const, name: "payload.old" },
];
describe("web atomic CloudKit adapter", () => {
  it("uses an atomic custom zone batch with conditional guards and guarded deletes", async () => {
    const f = fixture(); await f.store.atomic(operations);
    expect(f.db.newRecordsBatch).toHaveBeenCalledWith({ zoneID: { zoneName: cloudLibraryZoneName(identity) }, atomic: true });
    expect(f.batch.update).toHaveBeenCalledWith(expect.objectContaining({ recordChangeTag: "old" }));
    expect(f.batch.forceDelete).toHaveBeenCalledWith({ recordName: "payload.old" });
    expect(f.guard).toHaveBeenCalledTimes(4);
    expect(f.db.saveRecordZones).not.toHaveBeenCalled();
  });
  it("refuses a zone without atomic capability before sending payloads", async () => {
    const f = fixture(); f.db.fetchRecordZones.mockResolvedValue({ zones: [{ zoneID: { zoneName: cloudLibraryZoneName(identity) }, atomic: false }] });
    await expect(f.store.atomic(operations)).rejects.toThrow(/atomic capability/);
    expect(f.batch.commit).not.toHaveBeenCalled();
  });
  it("propagates inner CAS failures of an atomic batch", async () => {
    const f = fixture(); f.batch.commit.mockResolvedValue({ records: [
      { recordName: "payload.old", serverErrorCode: "BATCH_REQUEST_FAILED" },
      { recordName: "ledger.deck", serverErrorCode: "SERVER_RECORD_CHANGED" },
    ] });
    await expect(f.store.atomic(operations)).rejects.toMatchObject({ code: "WRITE_CONFLICT" });
  });
  it("does not acknowledge incomplete success or a changed account", async () => {
    const f = fixture(); f.batch.commit.mockResolvedValue({ records: [] });
    await expect(f.store.atomic(operations)).rejects.toThrow(/incomplete/);
    const changed = fixture(); changed.guard.mockResolvedValueOnce(undefined).mockRejectedValue(new Error("account changed"));
    await expect(changed.store.atomic(operations)).rejects.toThrow("account changed");
    expect(changed.batch.commit).not.toHaveBeenCalled();
  });
});
