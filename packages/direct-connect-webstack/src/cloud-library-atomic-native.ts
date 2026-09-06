import { registerPlugin } from "@capacitor/core";
import type { CloudLibraryIdentity } from "@flashcards/domain/cloud-library";
import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import { cloudLibraryZoneName, validateCloudAtomicOperations,
  type CloudAtomicStore } from "@flashcards/sync/cloud-library-atomic";

export interface NativeAtomicCloudPlugin {
  createLibraryZone(input: { accountToken: string; zoneName: string }): Promise<{ created: boolean }>;
  readZoneRecord(input: { accountToken: string; zoneName: string; recordName: string }):
    Promise<{ record: { payload: string; changeTag: string } | null }>;
  atomicRecords(input: { accountToken: string; zoneName: string; operations: {
    kind: "save" | "delete"; name: string; expectedTag?: string; payload?: string;
  }[] }): Promise<{ committed: boolean }>;
}
const plugin = registerPlugin<NativeAtomicCloudPlugin>("FlashNFlipCloudLibrary");
export function createNativeAtomicCloudStore(accountToken: string, identity: CloudLibraryIdentity,
  bridge: NativeAtomicCloudPlugin = plugin): CloudAtomicStore & { createZone(): Promise<void> } {
  if (!accountToken) throw new Error("A durable account binding is required");
  const scope = { accountToken, zoneName: cloudLibraryZoneName(identity) };
  const request = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "WRITE_CONFLICT") throw new CloudLibraryError(code, "Atomic cloud guard changed");
      if (code === "ACCOUNT_CHANGED" || code === "AUTHENTICATION_REQUIRED")
        throw new CloudLibraryError("ACCOUNT_CHANGED", "iCloud account changed; preserve local data");
      throw error;
    }
  };
  return {
    async createZone() {
      if ((await request(() => bridge.createLibraryZone(scope))).created !== true) throw new Error("Cloud zone creation not confirmed");
    },
    async read(recordName) {
      if (!/^[a-zA-Z0-9.-]{1,255}$/.test(recordName)) throw new Error("Invalid cloud record name");
      const { record } = await request(() => bridge.readZoneRecord({ ...scope, recordName }));
      if (record === null) return null;
      if (!record?.changeTag || typeof record.payload !== "string" || new TextEncoder().encode(record.payload).length > 200 * 1024)
        throw new Error("Invalid native cloud record");
      return { value: JSON.parse(record.payload) as unknown, changeTag: record.changeTag };
    },
    async atomic(operations) {
      validateCloudAtomicOperations(operations);
      const result = await request(() => bridge.atomicRecords({ ...scope, operations: operations.map((operation) =>
        operation.kind === "delete" ? { kind: "delete", name: operation.name } : {
          kind: "save", name: operation.name, payload: JSON.stringify(operation.value),
          ...(operation.expectedTag === null ? {} : { expectedTag: operation.expectedTag }),
        }) }));
      if (result.committed !== true) throw new Error("Native atomic cloud write not confirmed");
    },
  };
}
