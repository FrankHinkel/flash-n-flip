import type { CloudLibraryIdentity } from "@flashcards/domain/cloud-library";
import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import { cloudLibraryZoneName, validateCloudAtomicOperations,
  type CloudAtomicStore } from "@flashcards/sync/cloud-library-atomic";
import { createCloudLibraryWebStore, cloudLibraryRecordType,
  type CloudLibraryWebDatabase } from "./cloud-library-web";

type Response = Awaited<ReturnType<CloudLibraryWebDatabase["fetchRecords"]>>;
type RecordValue = NonNullable<Response["records"]>[number] & { deleted?: boolean };
type ZoneResponse = { hasErrors?: boolean; errors?: { serverErrorCode?: string }[];
  zones?: { zoneID?: { zoneName?: string }; atomic?: boolean; serverErrorCode?: string }[] };
type Batch = {
  create(record: RecordValue): Batch;
  update(record: RecordValue): Batch;
  forceDelete(record: RecordValue): Batch;
  commit(): Promise<Response & { records?: RecordValue[] }>;
};
export interface CloudAtomicWebDatabase extends CloudLibraryWebDatabase {
  fetchRecords(name: string, options?: { zoneID: { zoneName: string } }): Promise<Response>;
  fetchRecordZones(zone: { zoneName: string }): Promise<ZoneResponse>;
  saveRecordZones(zone: { zoneID: { zoneName: string } }): Promise<ZoneResponse>;
  newRecordsBatch(options: { zoneID: { zoneName: string }; atomic: true }): Batch;
}
function fail(codes: (string | undefined)[]): never {
  if (codes.includes("AUTHENTICATION_REQUIRED")) throw new CloudLibraryError("ACCOUNT_CHANGED", "iCloud account changed");
  if (codes.includes("SERVER_RECORD_CHANGED") || codes.includes("RECORD_ALREADY_EXISTS"))
    throw new CloudLibraryError("WRITE_CONFLICT", "Atomic cloud guard changed");
  throw new Error("Atomic CloudKit request failed");
}

export function createWebAtomicCloudStore(database: CloudAtomicWebDatabase,
  assertAccount: () => Promise<void>, identity: CloudLibraryIdentity): CloudAtomicStore & {
    createZone(): Promise<void>;
  } {
  const zoneID = { zoneName: cloudLibraryZoneName(identity) };
  const request = async <T>(operation: () => Promise<T>): Promise<T> => {
    await assertAccount();
    let value: T;
    try { value = await operation(); }
    catch (error) {
      if (error && typeof error === "object" && "serverErrorCode" in error) fail([String(error.serverErrorCode)]);
      throw error;
    }
    await assertAccount(); return value;
  };
  const checkZone = (response: ZoneResponse): void => {
    const errors = [...(response.errors ?? []), ...(response.zones ?? []).filter((zone) => zone.serverErrorCode)];
    if (response.hasErrors || errors.length) fail(errors.map((error) => error.serverErrorCode));
    if (response.zones?.length !== 1 || response.zones[0]?.zoneID?.zoneName !== zoneID.zoneName ||
        response.zones[0]?.atomic !== true) throw new Error("Cloud zone does not confirm atomic capability");
  };
  const reader = createCloudLibraryWebStore({
    fetchRecords: (name) => database.fetchRecords(name, { zoneID }),
    saveRecords: async () => { throw new Error("Use the atomic cloud writer"); },
  }, assertAccount);
  return {
    read: (name) => reader.read(name),
    // Explicit bootstrap only. Never called by read/atomic or after a missing zone.
    async createZone() {
      checkZone(await request(() => database.saveRecordZones({ zoneID })));
    },
    async atomic(operations) {
      validateCloudAtomicOperations(operations);
      checkZone(await request(() => database.fetchRecordZones(zoneID)));
      const response = await request(async () => {
        const batch = database.newRecordsBatch({ zoneID, atomic: true });
        for (const operation of operations) {
          if (operation.kind === "delete") {
            // Deletion is protected by the conditional ledger/root save in
            // this SAME atomic batch, matching the native CKRecordID contract.
            batch.forceDelete({ recordName: operation.name });
          } else {
            const record: RecordValue = { recordName: operation.name, recordType: cloudLibraryRecordType,
              fields: { schemaVersion: { value: 1 }, payload: { value: JSON.stringify(operation.value) } },
              ...(operation.expectedTag === null ? {} : { recordChangeTag: operation.expectedTag }) };
            if (operation.expectedTag === null) batch.create(record); else batch.update(record);
          }
        }
        return batch.commit();
      });
      const errors = [...(response.errors ?? []), ...(response.records ?? []).filter((record) => record.serverErrorCode)];
      if (response.hasErrors || errors.length) fail(errors.map((error) => error.serverErrorCode));
      const records: RecordValue[] = response.records ?? [];
      if (records.length !== operations.length || new Set(records.map((record) => record.recordName)).size !== records.length)
        throw new Error("Atomic CloudKit response is incomplete");
      for (const operation of operations) {
        const record = records.find((entry) => entry.recordName === operation.name);
        if (!record || (operation.kind === "delete" ? record.deleted !== true :
          record.recordType !== cloudLibraryRecordType || !record.recordChangeTag || record.fields?.schemaVersion?.value !== 1 ||
          record.fields?.payload?.value !== JSON.stringify(operation.value)))
          throw new Error("Atomic CloudKit result does not match the requested operation");
      }
    },
  };
}
