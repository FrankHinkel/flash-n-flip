import { z } from "zod";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const safeAssetPathSchema = z
  .string()
  .min(1)
  .max(240)
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/);

export const webstackAssetSchema = z
  .object({
    path: safeAssetPathSchema,
    mediaType: z.string().min(1).max(120),
    byteSize: z
      .number()
      .int()
      .positive()
      .max(32 * 1024 * 1024),
    sha256: sha256Schema,
  })
  .strict();

export const webstackManifestSchema = z
  .object({
    format: z.literal("flash-n-flip-signed-webstack"),
    version: z.literal(1),
    buildId: z.string().min(1).max(120),
    appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    createdAt: z.string().datetime(),
    entrypoint: safeAssetPathSchema,
    minimumBootstrapVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    protocolGenerations: z
      .object({
        rendezvous: z.literal(1),
        localSync: z.literal(1),
        webstack: z.literal(1),
      })
      .strict(),
    signingKeyId: z.string().min(1).max(80),
    totalBytes: z
      .number()
      .int()
      .positive()
      .max(128 * 1024 * 1024),
    assets: z.array(webstackAssetSchema).min(2).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.assets.some((asset) => asset.path === value.entrypoint)) {
      context.addIssue({
        code: "custom",
        message: "Webstack entrypoint is missing",
      });
    }
    if (
      new Set(value.assets.map((asset) => asset.path)).size !==
      value.assets.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Webstack asset paths must be unique",
      });
    }
    if (
      value.assets.reduce((sum, asset) => sum + asset.byteSize, 0) !==
      value.totalBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Webstack total byte count mismatch",
      });
    }
  });

export const signedWebstackReleaseSchema = z
  .object({
    manifest: webstackManifestSchema,
    signatureBase64: z
      .string()
      .min(80)
      .max(256)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();

export const webstackPeerMessageSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("WEBSTACK_OFFER"),
      version: z.literal(1),
      release: signedWebstackReleaseSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("WEBSTACK_CURRENT"),
      version: z.literal(1),
      buildId: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      kind: z.literal("WEBSTACK_REQUEST"),
      version: z.literal(1),
      buildId: z.string().min(1).max(120),
      paths: z.array(safeAssetPathSchema).min(1).max(64),
    })
    .strict(),
  z
    .object({
      kind: z.literal("WEBSTACK_CHUNK"),
      version: z.literal(1),
      buildId: z.string().min(1).max(120),
      path: safeAssetPathSchema,
      index: z.number().int().nonnegative(),
      chunkCount: z.number().int().positive().max(65_536),
      dataBase64: z
        .string()
        .min(1)
        .max(512 * 1024)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    })
    .strict(),
  z
    .object({
      kind: z.literal("WEBSTACK_COMPLETE"),
      version: z.literal(1),
      buildId: z.string().min(1).max(120),
    })
    .strict(),
  z
    .object({
      kind: z.literal("WEBSTACK_REJECT"),
      version: z.literal(1),
      buildId: z.string().min(1).max(120),
      reason: z.string().min(1).max(240),
    })
    .strict(),
]);

export type WebstackManifest = z.infer<typeof webstackManifestSchema>;
export type SignedWebstackRelease = z.infer<typeof signedWebstackReleaseSchema>;
export type WebstackPeerMessage = z.infer<typeof webstackPeerMessageSchema>;
