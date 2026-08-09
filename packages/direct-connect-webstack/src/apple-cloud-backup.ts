import { Capacitor, registerPlugin } from "@capacitor/core";

import {
  cloudAccountStatusSchema,
  familyLibraryDescriptorSchema,
  type CloudAccountStatus,
  type FamilyLibraryDescriptor,
} from "@flashcards/domain/cloud-backup";
import type { LocalAppBackupEnvelope } from "@flashcards/domain/local-app-data";
import {
  createEncryptedCloudBackup,
  decryptCloudBackup,
} from "@flashcards/sync/cloud-backup";

type AppleCloudPlugin = {
  accountStatus(): Promise<{ status: string; accountToken?: string }>;
  getOrCreateRecoveryKey(): Promise<{
    keyBase64: string;
    storage: "ICLOUD_KEYCHAIN";
  }>;
  uploadEncryptedBackup(input: {
    envelope: string;
  }): Promise<{ recordName: string }>;
  downloadLatestEncryptedBackup(): Promise<{ envelope: string | null }>;
  deleteEncryptedBackup(): Promise<void>;
  createFamilyLibrary(input: { title: string }): Promise<unknown>;
};

const appleCloud = registerPlugin<AppleCloudPlugin>("FlashNFlipAppleCloud");
const accountBindingKey = "flash-n-flip.apple-cloud-account.v1";

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const requireAppleRuntime = (): void => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    throw new Error("iCloud backup is available only in the Apple app");
  }
};

export const isAppleCloudRuntime = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export async function appleCloudAccountStatus(): Promise<CloudAccountStatus> {
  requireAppleRuntime();
  return cloudAccountStatusSchema.parse(
    (await appleCloud.accountStatus()).status,
  );
}

async function assertStableAppleCloudAccount(): Promise<void> {
  const account = await appleCloud.accountStatus();
  if (
    cloudAccountStatusSchema.parse(account.status) !== "AVAILABLE" ||
    !account.accountToken
  ) {
    throw new Error("iCloud account is unavailable");
  }
  const bound = localStorage.getItem(accountBindingKey);
  if (bound && bound !== account.accountToken) {
    throw new Error(
      "Der Apple-Account wurde gewechselt. Lokale Daten bleiben unverändert; exportiere sie, bevor du iCloud neu verknüpfst.",
    );
  }
  if (!bound) localStorage.setItem(accountBindingKey, account.accountToken);
}

async function recoveryKey(): Promise<Uint8Array> {
  await assertStableAppleCloudAccount();
  const value = await appleCloud.getOrCreateRecoveryKey();
  if (value.storage !== "ICLOUD_KEYCHAIN")
    throw new Error("Unexpected recovery key storage");
  const key = base64ToBytes(value.keyBase64);
  if (key.byteLength !== 32) throw new Error("Invalid iCloud recovery key");
  return key;
}

export async function uploadAppleCloudBackup(input: {
  backup: LocalAppBackupEnvelope;
  sourceDeviceId: string;
}): Promise<void> {
  requireAppleRuntime();
  const envelope = await createEncryptedCloudBackup({
    backup: input.backup,
    sourceDeviceId: input.sourceDeviceId,
    recoveryKey: await recoveryKey(),
  });
  await appleCloud.uploadEncryptedBackup({
    envelope: JSON.stringify(envelope),
  });
}

export async function downloadAppleCloudBackup(): Promise<LocalAppBackupEnvelope | null> {
  requireAppleRuntime();
  const downloaded = await appleCloud.downloadLatestEncryptedBackup();
  if (downloaded.envelope === null) return null;
  return decryptCloudBackup(
    JSON.parse(downloaded.envelope) as unknown,
    await recoveryKey(),
  );
}

export async function deleteAppleCloudBackup(): Promise<void> {
  requireAppleRuntime();
  await assertStableAppleCloudAccount();
  await appleCloud.deleteEncryptedBackup();
}

export async function createAppleFamilyLibrary(
  title: string,
): Promise<FamilyLibraryDescriptor> {
  requireAppleRuntime();
  await assertStableAppleCloudAccount();
  return familyLibraryDescriptorSchema.parse(
    await appleCloud.createFamilyLibrary({ title }),
  );
}
