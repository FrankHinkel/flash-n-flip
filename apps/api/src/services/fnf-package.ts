import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";

import { z } from "zod";

import {
  cardContentSchema,
  isValidCardContentPair,
  localizedCardContentsSchema,
} from "@flashcards/domain/content";

const magic = Buffer.from("FNFDECK1", "ascii");
const privateKeyPrefix = Buffer.from("302e020100300506032b657004220420", "hex");

const assetSchema = z.object({
  sourceMediaId: z.uuid(),
  mimeType: z.string().trim().min(1).max(100),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  altText: z.string().max(500).nullable(),
  data: z.string().max(180_000_000),
});

export const flashNFlipManifestSchema = z
  .object({
    format: z.literal("flash-n-flip.deck"),
    formatVersion: z.literal(1),
    packageId: z.uuid(),
    exportedAt: z.string().datetime(),
    deck: z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(1000),
      language: z.string().trim().min(2).max(16),
      contentLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(20),
      defaultContentLocale: z.string().trim().min(2).max(16),
      studyOrder: z.enum(["SCHEDULED", "SEQUENTIAL"]).default("SCHEDULED"),
      protectionMode: z.literal("ACCOUNT_BOUND"),
      tags: z.array(z.string().trim().min(1).max(40)).max(30),
    }),
    cards: z
      .array(
        z.object({
          sourceCardId: z.uuid(),
          front: cardContentSchema,
          back: cardContentSchema,
          translations: localizedCardContentsSchema,
          kind: z.enum(["QUESTION", "EXPLANATION"]).default("QUESTION"),
          position: z.number().int().positive().default(1),
          linkedToPrevious: z.boolean().default(false),
          tags: z.array(z.string().trim().min(1).max(40)).max(30),
        }),
      )
      .max(50_000),
    assets: z.array(assetSchema).max(10_000),
  })
  .superRefine((manifest, context) => {
    if (
      !manifest.deck.contentLocales.includes(manifest.deck.defaultContentLocale)
    ) {
      context.addIssue({
        code: "custom",
        path: ["deck", "defaultContentLocale"],
        message: "Default content locale is not available",
      });
    }
    manifest.cards.forEach((card, cardIndex) => {
      if (!isValidCardContentPair(card.kind, card.front, card.back)) {
        context.addIssue({
          code: "custom",
          path: ["cards", cardIndex],
          message:
            card.kind === "EXPLANATION"
              ? "Explanation cards require an empty front and non-empty back"
              : "Question cards require an answer or cloze",
        });
      }
      for (const locale of Object.keys(card.translations)) {
        if (!manifest.deck.contentLocales.includes(locale)) {
          context.addIssue({
            code: "custom",
            path: ["cards", cardIndex, "translations", locale],
            message: "Card translation locale is not available in the deck",
          });
        }
      }
    });
  });

export type FlashNFlipManifest = z.infer<typeof flashNFlipManifestSchema>;

type EnvelopeHeader = {
  formatVersion: 1;
  packageId: string;
  cipher: "AES-256-GCM";
  compression: "gzip";
  keyWrap: "HKDF-SHA256+AES-256-GCM";
  ownerBinding: string;
  payloadIv: string;
  payloadTag: string;
  wrappedKey: string;
  wrapIv: string;
  wrapTag: string;
  payloadSha256: string;
  signingPublicKey: string;
  signature: string;
};

const b64 = (value: Buffer): string => value.toString("base64");
const fromB64 = (value: string): Buffer => Buffer.from(value, "base64");
const sha256 = (value: Buffer | string): Buffer =>
  createHash("sha256").update(value).digest();

const ownerBinding = (masterSecret: string, userId: string): string =>
  createHmac("sha256", masterSecret)
    .update(`flash-n-flip-owner:${userId}`)
    .digest("hex");

const keyEncryptionKey = (
  masterSecret: string,
  userId: string,
  packageId: string,
): Buffer =>
  Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(masterSecret, "utf8"),
      Buffer.from(packageId, "utf8"),
      Buffer.from(`flash-n-flip-package:${userId}`, "utf8"),
      32,
    ),
  );

const signingKeys = (masterSecret: string) => {
  const seed = sha256(`flash-n-flip-signing:${masterSecret}`);
  const privateKey = createPrivateKey({
    key: Buffer.concat([privateKeyPrefix, seed]),
    format: "der",
    type: "pkcs8",
  });
  return { privateKey, publicKey: createPublicKey(privateKey as never) };
};

const unsignedHeader = (header: EnvelopeHeader) => {
  const { signature: _signature, ...unsigned } = header;
  return Buffer.from(JSON.stringify(unsigned), "utf8");
};

const signatureInput = (header: EnvelopeHeader, ciphertext: Buffer): Buffer =>
  Buffer.concat([magic, unsignedHeader(header), ciphertext]);

export const createFlashNFlipPackage = (
  manifestInput: FlashNFlipManifest,
  userId: string,
  masterSecret: string,
): Buffer => {
  const manifest = flashNFlipManifestSchema.parse(manifestInput);
  const plaintext = gzipSync(Buffer.from(JSON.stringify(manifest), "utf8"), {
    level: 9,
  });
  const contentKey = randomBytes(32);
  const payloadIv = randomBytes(12);
  const payloadCipher = createCipheriv("aes-256-gcm", contentKey, payloadIv);
  const ciphertext = Buffer.concat([
    payloadCipher.update(plaintext),
    payloadCipher.final(),
  ]);
  const payloadTag = payloadCipher.getAuthTag();

  const wrapIv = randomBytes(12);
  const wrapCipher = createCipheriv(
    "aes-256-gcm",
    keyEncryptionKey(masterSecret, userId, manifest.packageId),
    wrapIv,
  );
  const wrappedKey = Buffer.concat([
    wrapCipher.update(contentKey),
    wrapCipher.final(),
  ]);
  const wrapTag = wrapCipher.getAuthTag();
  const { privateKey, publicKey } = signingKeys(masterSecret);
  const header: EnvelopeHeader = {
    formatVersion: 1,
    packageId: manifest.packageId,
    cipher: "AES-256-GCM",
    compression: "gzip",
    keyWrap: "HKDF-SHA256+AES-256-GCM",
    ownerBinding: ownerBinding(masterSecret, userId),
    payloadIv: b64(payloadIv),
    payloadTag: b64(payloadTag),
    wrappedKey: b64(wrappedKey),
    wrapIv: b64(wrapIv),
    wrapTag: b64(wrapTag),
    payloadSha256: sha256(ciphertext).toString("hex"),
    signingPublicKey: b64(
      publicKey.export({ format: "der", type: "spki" }) as Buffer,
    ),
    signature: "",
  };
  header.signature = b64(
    sign(null, signatureInput(header, ciphertext), privateKey),
  );
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(headerBytes.length);
  return Buffer.concat([magic, headerLength, headerBytes, ciphertext]);
};

export const readFlashNFlipPackage = (
  input: Buffer,
  userId: string,
  masterSecret: string,
): FlashNFlipManifest => {
  if (input.length < magic.length + 4 || !input.subarray(0, 8).equals(magic)) {
    throw new Error("Not a Flash-n-Flip deck package");
  }
  const headerLength = input.readUInt32BE(magic.length);
  if (headerLength < 100 || headerLength > 32_768) {
    throw new Error("Invalid Flash-n-Flip package header");
  }
  const payloadOffset = magic.length + 4 + headerLength;
  if (payloadOffset >= input.length) {
    throw new Error("Truncated Flash-n-Flip package");
  }
  const header = z
    .object({
      formatVersion: z.literal(1),
      packageId: z.uuid(),
      cipher: z.literal("AES-256-GCM"),
      compression: z.literal("gzip"),
      keyWrap: z.literal("HKDF-SHA256+AES-256-GCM"),
      ownerBinding: z.string().length(64),
      payloadIv: z.string().min(1),
      payloadTag: z.string().min(1),
      wrappedKey: z.string().min(1),
      wrapIv: z.string().min(1),
      wrapTag: z.string().min(1),
      payloadSha256: z.string().length(64),
      signingPublicKey: z.string().min(1),
      signature: z.string().min(1),
    })
    .parse(JSON.parse(input.subarray(12, payloadOffset).toString("utf8")));
  const ciphertext = input.subarray(payloadOffset);
  if (sha256(ciphertext).toString("hex") !== header.payloadSha256) {
    throw new Error("Flash-n-Flip package payload is corrupted");
  }
  const expectedKeys = signingKeys(masterSecret);
  const expectedPublicKey = expectedKeys.publicKey.export({
    format: "der",
    type: "spki",
  }) as Buffer;
  if (!expectedPublicKey.equals(fromB64(header.signingPublicKey))) {
    throw new Error("Flash-n-Flip package has an unknown publisher");
  }
  if (
    !verify(
      null,
      signatureInput(header, ciphertext),
      expectedKeys.publicKey,
      fromB64(header.signature),
    )
  ) {
    throw new Error("Flash-n-Flip package signature is invalid");
  }
  if (header.ownerBinding !== ownerBinding(masterSecret, userId)) {
    throw new Error("This protected deck belongs to another account");
  }
  const unwrap = createDecipheriv(
    "aes-256-gcm",
    keyEncryptionKey(masterSecret, userId, header.packageId),
    fromB64(header.wrapIv),
  );
  unwrap.setAuthTag(fromB64(header.wrapTag));
  const contentKey = Buffer.concat([
    unwrap.update(fromB64(header.wrappedKey)),
    unwrap.final(),
  ]);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    contentKey,
    fromB64(header.payloadIv),
  );
  decipher.setAuthTag(fromB64(header.payloadTag));
  const compressed = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  const manifest = JSON.parse(
    gunzipSync(compressed, { maxOutputLength: 256 * 1024 * 1024 }).toString(
      "utf8",
    ),
  );
  return flashNFlipManifestSchema.parse(manifest);
};
