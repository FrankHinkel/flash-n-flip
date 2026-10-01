import { Capacitor } from "@capacitor/core";
import {
  cloudLibraryPolicySchema,
  type CloudLibraryPolicy,
} from "@flashcards/domain/cloud-library";
import type { LocalAuthorityStorage } from "@flashcards/sync/local-authority";
import {
  createBrowserCloudKeyValue,
  createNativeCloudKeyValue,
} from "./cloud-library-storage";

export type { CloudLibraryPolicy };
export const cloudPolicyKey = "runtime.policy.v3";
export const cloudPolicyChanged = "flash-n-flip:cloud-policy-changed";
export const cloudValues = () =>
  Capacitor.isNativePlatform()
    ? createNativeCloudKeyValue()
    : createBrowserCloudKeyValue();
export async function readCloudPolicy(): Promise<CloudLibraryPolicy | null> {
  const raw = await cloudValues().read(cloudPolicyKey);
  if (raw === null) return null;
  try {
    if (raw.length > 4096 || new TextEncoder().encode(raw).byteLength > 4096)
      throw new Error("Oversized policy");
    return cloudLibraryPolicySchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("Invalid cloud policy; preserve local data");
  }
}

let serial: Promise<unknown> = Promise.resolve();
export async function withCloudAuthorityLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return await navigator.locks.request(
      "flash-n-flip.cloud-authority.v3",
      operation,
    );
  const task = serial.then(operation, operation);
  serial = task.catch(() => undefined);
  return task;
}
export async function updateCloudPolicy(
  change: (current: CloudLibraryPolicy | null) => CloudLibraryPolicy,
): Promise<void> {
  await withCloudAuthorityLock(async () => {
    const current = await readCloudPolicy();
    const next = cloudLibraryPolicySchema.parse(change(current));
    if (
      current &&
      (current.account !== next.account ||
        current.environment !== next.environment)
    )
      throw new Error("Cloud account binding changed; preserve local data");
    await cloudValues().update(cloudPolicyKey, () => JSON.stringify(next));
  });
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(cloudPolicyChanged));
}
export async function assertPeerLibraryAllowed(): Promise<void> {
  if (await readCloudPolicy())
    throw new Error(
      "Diese Bibliothek nutzt iCloud. Direktabgleich ist gesperrt, auch nach dem Abmelden.",
    );
}
export async function assertLegacyCloudDeletionAllowed(): Promise<void> {
  if (await readCloudPolicy())
    throw new Error(
      "Bitte in den iCloud-Einstellungen entfernen oder den Fortschritt ueberall zuruecksetzen. Lokale Lernstaende bleiben bis dahin erhalten.",
    );
}

// Activation/deletion intent and mutations share this cross-tab transaction lock.
export function cloudFencedStorage(
  storage: LocalAuthorityStorage,
  deviceId: string,
  privileged = false,
): LocalAuthorityStorage {
  return {
    transaction: (mode, operation) =>
      mode === "readonly"
        ? storage.transaction(mode, operation)
        : withCloudAuthorityLock(async () => {
            const policy = await readCloudPolicy();
            if (policy?.blocked && !privileged)
              throw new Error(
                "Ein bestaetigter iCloud-Loeschauftrag ist noch offen. Bitte iCloud-Abgleich fortsetzen; lokale Daten bleiben bis zur Cloud-Bestaetigung erhalten.",
              );
            let mutated = false;
            const result = await storage.transaction(mode, (tx) =>
              operation({
                ...tx,
                putMutation: async (mutation) => {
                  if (policy && mutation.originDeviceId !== deviceId)
                    throw new Error(
                      "Peer writes are fenced for the iCloud library",
                    );
                  await tx.putMutation(mutation);
                  mutated = true;
                },
              }),
            );
            if (mutated && !privileged && typeof window !== "undefined")
              window.dispatchEvent(
                new CustomEvent("flash-n-flip:decks-changed", {
                  detail: { source: "local-mutation" },
                }),
              );
            return result;
          }),
  };
}
