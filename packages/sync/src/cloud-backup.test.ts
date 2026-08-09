import { describe, expect, it } from "vitest";

import type { LocalAppBackupEnvelope } from "@flashcards/domain/local-app-data";

import { createEncryptedCloudBackup, decryptCloudBackup } from "./cloud-backup";

const deviceId = "11111111-1111-4111-8111-111111111111";
const backup: LocalAppBackupEnvelope = {
  format: "flash-n-flip-local-backup",
  version: 1,
  exportedAt: "2026-08-10T09:00:00.000Z",
  authority: {
    format: "flash-n-flip-local-authority",
    version: 1,
    payloadSha256: "0".repeat(64),
    payload: {
      schemaVersion: 1,
      exportedAt: "2026-08-10T09:00:00.000Z",
      source: { deviceId, nextOriginSequence: 1 },
      entities: [],
      mutationJournal: [],
      outboxMutationIds: [],
      replicaWatermarks: {},
    },
  },
  media: [],
};

describe("encrypted CloudKit backup envelope", () => {
  it("round-trips a complete local backup without exposing plaintext", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const encrypted = await createEncryptedCloudBackup({
      backup,
      sourceDeviceId: deviceId,
      recoveryKey: key,
      chunkSize: 64 * 1024,
      backupId: "22222222-2222-4222-8222-222222222222",
      createdAt: "2026-08-10T10:00:00.000Z",
    });

    expect(JSON.stringify(encrypted)).not.toContain(
      "flash-n-flip-local-backup",
    );
    await expect(decryptCloudBackup(encrypted, key)).resolves.toEqual(backup);
  });

  it("rejects the wrong key and manipulated ciphertext before restore", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const encrypted = await createEncryptedCloudBackup({
      backup,
      sourceDeviceId: deviceId,
      recoveryKey: key,
      chunkSize: 64 * 1024,
    });
    await expect(
      decryptCloudBackup(encrypted, crypto.getRandomValues(new Uint8Array(32))),
    ).rejects.toThrow(/authentic|authenticated/i);

    const changed = structuredClone(encrypted);
    changed.chunks[0]!.ciphertextBase64 = `${changed.chunks[0]!.ciphertextBase64.slice(0, -4)}AAAA`;
    await expect(decryptCloudBackup(changed, key)).rejects.toThrow(/corrupt/i);
  });
});
