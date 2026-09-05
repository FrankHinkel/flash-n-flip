import { Capacitor, registerPlugin } from "@capacitor/core";
import { CloudLibraryError } from "@flashcards/sync/cloud-library";
import type { CloudRecordStore } from "@flashcards/sync/cloud-library";

type NativeRecord = { payload: string; changeTag: string };
export interface NativeCloudLibraryPlugin {
  accountStatus(): Promise<{ accountToken: string }>;
  readRecord(input: {
    accountToken: string;
    recordName: string;
  }): Promise<{ record: NativeRecord | null }>;
  compareAndSwap(input: {
    accountToken: string;
    recordName: string;
    expectedTag?: string;
    payload: string;
  }): Promise<{ record: NativeRecord }>;
}

const plugin = registerPlugin<NativeCloudLibraryPlugin>(
  "FlashNFlipCloudLibrary",
);
export const nativeCloudLibraryAvailable = (): boolean =>
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === "ios" &&
  Capacitor.isPluginAvailable("FlashNFlipCloudLibrary");

export async function nativeCloudLibraryAccount(): Promise<string> {
  if (!nativeCloudLibraryAvailable())
    throw new Error("Native iCloud library has not been configured");
  return (await plugin.accountStatus()).accountToken;
}

export function createNativeCloudLibraryStore(
  accountToken: string,
  bridge: NativeCloudLibraryPlugin = plugin,
): CloudRecordStore {
  if (!accountToken) throw new Error("A durable account binding is required");
  const decode = (record: NativeRecord) => {
    if (
      !record.changeTag ||
      typeof record.payload !== "string" ||
      new TextEncoder().encode(record.payload).byteLength > 200 * 1024
    ) {
      throw new CloudLibraryError(
        "INVALID_REMOTE_RECORD",
        "Native CloudKit returned an invalid record",
      );
    }
    return {
      value: JSON.parse(record.payload) as unknown,
      changeTag: record.changeTag,
    };
  };
  const request = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String(error.code)
          : "";
      if (code === "WRITE_CONFLICT")
        throw new CloudLibraryError(code, "Native CloudKit record changed");
      if (code === "ACCOUNT_CHANGED" || code === "AUTHENTICATION_REQUIRED") {
        throw new CloudLibraryError(
          "ACCOUNT_CHANGED",
          "The iCloud account changed; preserve the local outbox",
        );
      }
      throw error;
    }
  };
  const validName = (name: string): void => {
    if (!/^[a-zA-Z0-9.-]{1,255}$/.test(name))
      throw new Error("Invalid CloudKit record name");
  };
  return {
    async read(recordName) {
      validName(recordName);
      const { record } = await request(() =>
        bridge.readRecord({ accountToken, recordName }),
      );
      return record === null ? null : decode(record);
    },
    async compareAndSwap(recordName, expectedTag, value) {
      validName(recordName);
      const payload = JSON.stringify(value);
      if (
        payload === undefined ||
        new TextEncoder().encode(payload).byteLength > 200 * 1024 ||
        expectedTag === ""
      ) {
        throw new Error("Invalid CloudKit payload or change tag");
      }
      const { record } = await request(() =>
        bridge.compareAndSwap({
          accountToken,
          recordName,
          payload,
          ...(expectedTag !== null ? { expectedTag } : {}),
        }),
      );
      decode(record);
    },
  };
}
