import { z } from "zod";

const base64Schema = z
  .string()
  .min(1)
  .max(16 * 1024 * 1024)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const cloudAccountStatusSchema = z.enum([
  "AVAILABLE",
  "NO_ACCOUNT",
  "RESTRICTED",
  "COULD_NOT_DETERMINE",
  "UNAVAILABLE",
]);

export const encryptedCloudBackupChunkSchema = z
  .object({
    index: z.number().int().nonnegative(),
    ivBase64: base64Schema.max(64),
    ciphertextBase64: base64Schema,
    ciphertextSha256: sha256Schema,
    byteSize: z
      .number()
      .int()
      .positive()
      .max(8 * 1024 * 1024),
  })
  .strict();

export const encryptedCloudBackupManifestSchema = z
  .object({
    format: z.literal("flash-n-flip-encrypted-cloud-backup"),
    version: z.literal(1),
    backupId: z.uuid(),
    createdAt: z.string().datetime(),
    sourceDeviceId: z.uuid(),
    payloadSha256: sha256Schema,
    plaintextBytes: z
      .number()
      .int()
      .nonnegative()
      .max(512 * 1024 * 1024),
    chunkSize: z
      .number()
      .int()
      .min(64 * 1024)
      .max(4 * 1024 * 1024),
    chunkCount: z.number().int().positive().max(8_192),
    keyDerivation: z.literal("HKDF-SHA256"),
    encryption: z.literal("AES-256-GCM"),
    manifestMac: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const encryptedCloudBackupEnvelopeSchema = z
  .object({
    manifest: encryptedCloudBackupManifestSchema,
    chunks: z.array(encryptedCloudBackupChunkSchema).min(1).max(8_192),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.chunks.length !== value.manifest.chunkCount) {
      context.addIssue({
        code: "custom",
        message: "Cloud backup chunk count mismatch",
      });
    }
    for (let index = 0; index < value.chunks.length; index += 1) {
      if (value.chunks[index]?.index !== index) {
        context.addIssue({
          code: "custom",
          message: "Cloud backup chunks must be contiguous",
        });
        break;
      }
    }
  });

export const cloudBackupDescriptorSchema = z
  .object({
    backupId: z.uuid(),
    createdAt: z.string().datetime(),
    sourceDeviceId: z.uuid(),
    byteSize: z.number().int().nonnegative(),
  })
  .strict();

export const familyLibraryDescriptorSchema = z
  .object({
    libraryId: z.uuid(),
    title: z.string().trim().min(1).max(120),
    role: z.enum(["OWNER", "PARTICIPANT"]),
    permission: z.enum(["READ_ONLY", "READ_WRITE"]),
    shareUrl: z.url().nullable(),
  })
  .strict();

export type CloudAccountStatus = z.infer<typeof cloudAccountStatusSchema>;
export type EncryptedCloudBackupEnvelope = z.infer<
  typeof encryptedCloudBackupEnvelopeSchema
>;
export type EncryptedCloudBackupManifest = z.infer<
  typeof encryptedCloudBackupManifestSchema
>;
export type CloudBackupDescriptor = z.infer<typeof cloudBackupDescriptorSchema>;
export type FamilyLibraryDescriptor = z.infer<
  typeof familyLibraryDescriptorSchema
>;
