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
import * as yauzl from "yauzl";
import * as yazl from "yazl";
import { z } from "zod";

import { geographyMapIds } from "@flashcards/domain";
import {
  cardContentSchema,
  isValidCardContentPair,
  localizedCardContentsSchema,
} from "@flashcards/domain/content";

const zipMagic = Buffer.from("FNFPAK02", "ascii");
const privateKeyPrefix = Buffer.from("302e020100300506032b657004220420", "hex");
const maximumExpandedBytes = 256 * 1024 * 1024;
const maximumArchiveEntries = 10_001;

const assetSchema = z.object({
  sourceMediaId: z.uuid(),
  mimeType: z.string().trim().min(1).max(100),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  altText: z.string().max(500).nullable(),
  data: z.string().max(180_000_000),
});

const deckMetadataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  language: z.string().trim().min(2).max(16),
  contentLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(20),
  defaultContentLocale: z.string().trim().min(2).max(16),
  sourceLocale: z.string().trim().min(2).max(16).optional(),
  targetLocale: z.string().trim().min(2).max(16).optional(),
  studyOrder: z.enum(["SCHEDULED", "SEQUENTIAL"]).default("SCHEDULED"),
  protectionMode: z.literal("ACCOUNT_BOUND"),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
});

const packageCardBaseSchema = z.object({
  sourceCardId: z.uuid(),
  front: cardContentSchema,
  back: cardContentSchema,
  questionLocale: z.string().trim().min(2).max(16).nullable().optional(),
  answerLocale: z.string().trim().min(2).max(16).nullable().optional(),
  translations: localizedCardContentsSchema,
  kind: z.enum(["QUESTION", "EXPLANATION"]).default("QUESTION"),
  position: z.number().int().positive().default(1),
  linkedToPrevious: z.boolean().default(false),
});

const packageVisualSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("GLOBE"), value: z.literal("world") }),
    z.object({ kind: z.literal("MAP"), value: z.enum(geographyMapIds) }),
    z.object({
      kind: z.literal("FLAG"),
      value: z.string().regex(/^[A-Z]{2}$/),
    }),
    z.object({ kind: z.literal("IMAGE"), value: z.uuid() }),
  ])
  .nullable();

const boundedRecordSchema = z
  .record(z.string().min(1).max(120), z.unknown())
  .refine((value) => Object.keys(value).length <= 500, "Too many fields");

const packageDeckSchema = deckMetadataSchema.extend({
  sourceDeckId: z.uuid(),
  sourceParentDeckId: z.uuid().nullable(),
  visual: packageVisualSchema,
});

const packageNoteTypeSchema = z.object({
  sourceNoteTypeId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  fields: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(120),
        label: z.string().trim().min(1).max(120),
      }),
    )
    .max(500),
});

const packageCardTemplateSchema = z.object({
  sourceTemplateId: z.uuid(),
  sourceNoteTypeId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  front: boundedRecordSchema,
  back: boundedRecordSchema,
});

const packageNoteSchema = z.object({
  sourceNoteId: z.uuid(),
  sourceDeckId: z.uuid(),
  sourceNoteTypeId: z.uuid().nullable(),
  fields: boundedRecordSchema,
  tags: z.array(z.string().trim().min(1).max(200)).max(500),
});

const packageCardSchema = packageCardBaseSchema.extend({
  sourceDeckId: z.uuid(),
  sourceNoteId: z.uuid(),
  sourceTemplateId: z.uuid().nullable(),
  suspended: z.boolean().default(false),
});

const flashNFlipManifestBaseSchema = z.object({
  format: z.literal("flash-n-flip.collection"),
  formatVersion: z.literal(2),
  packageId: z.uuid(),
  exportedAt: z.string().datetime(),
  rootSourceDeckId: z.uuid(),
  decks: z.array(packageDeckSchema).min(1).max(10_000),
  noteTypes: z.array(packageNoteTypeSchema).max(10_000),
  cardTemplates: z.array(packageCardTemplateSchema).max(20_000),
  notes: z.array(packageNoteSchema).max(50_000),
  cards: z.array(packageCardSchema).max(50_000),
  assets: z.array(assetSchema).max(10_000),
});

export const flashNFlipManifestSchema =
  flashNFlipManifestBaseSchema.superRefine((manifest, context) => {
    const reportDuplicateIds = (
      values: readonly string[],
      path: string,
      field: string,
    ) => {
      const seen = new Set<string>();
      values.forEach((value, index) => {
        if (seen.has(value)) {
          context.addIssue({
            code: "custom",
            path: [path, index, field],
            message: `Duplicate ${field}`,
          });
        }
        seen.add(value);
      });
    };
    reportDuplicateIds(
      manifest.decks.map((deck) => deck.sourceDeckId),
      "decks",
      "sourceDeckId",
    );
    reportDuplicateIds(
      manifest.noteTypes.map((noteType) => noteType.sourceNoteTypeId),
      "noteTypes",
      "sourceNoteTypeId",
    );
    reportDuplicateIds(
      manifest.cardTemplates.map((template) => template.sourceTemplateId),
      "cardTemplates",
      "sourceTemplateId",
    );
    reportDuplicateIds(
      manifest.notes.map((note) => note.sourceNoteId),
      "notes",
      "sourceNoteId",
    );
    reportDuplicateIds(
      manifest.cards.map((card) => card.sourceCardId),
      "cards",
      "sourceCardId",
    );
    reportDuplicateIds(
      manifest.assets.map((asset) => asset.sourceMediaId),
      "assets",
      "sourceMediaId",
    );
    const deckById = new Map(
      manifest.decks.map((deck) => [deck.sourceDeckId, deck]),
    );
    const deckIds = new Set(deckById.keys());
    const noteTypeIds = new Set(
      manifest.noteTypes.map((noteType) => noteType.sourceNoteTypeId),
    );
    const templateIds = new Set(
      manifest.cardTemplates.map((template) => template.sourceTemplateId),
    );
    const noteIds = new Set(manifest.notes.map((note) => note.sourceNoteId));
    if (!deckIds.has(manifest.rootSourceDeckId)) {
      context.addIssue({
        code: "custom",
        path: ["rootSourceDeckId"],
        message: "Collection root is missing",
      });
    }
    const rootDeck = deckById.get(manifest.rootSourceDeckId);
    if (rootDeck?.sourceParentDeckId) {
      context.addIssue({
        code: "custom",
        path: ["rootSourceDeckId"],
        message: "Collection root must not have a parent",
      });
    }
    const parentByDeck = new Map(
      manifest.decks.map((deck) => [
        deck.sourceDeckId,
        deck.sourceParentDeckId,
      ]),
    );
    const resolvedHierarchy = new Set<string>();
    for (const deck of manifest.decks) {
      if (resolvedHierarchy.has(deck.sourceDeckId)) continue;
      const visited = new Set<string>();
      const chain: string[] = [];
      let current: string | null = deck.sourceDeckId;
      while (current && !resolvedHierarchy.has(current)) {
        if (visited.has(current)) {
          context.addIssue({
            code: "custom",
            path: ["decks"],
            message: "Deck hierarchy contains a cycle",
          });
          break;
        }
        visited.add(current);
        chain.push(current);
        current = parentByDeck.get(current) ?? null;
      }
      chain.forEach((id) => resolvedHierarchy.add(id));
    }
    manifest.decks.forEach((deck, index) => {
      if (!deck.contentLocales.includes(deck.defaultContentLocale)) {
        context.addIssue({
          code: "custom",
          path: ["decks", index, "defaultContentLocale"],
          message: "Default content locale is not available",
        });
      }
      if (
        deck.sourceParentDeckId &&
        (!deckIds.has(deck.sourceParentDeckId) ||
          deck.sourceParentDeckId === deck.sourceDeckId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["decks", index, "sourceParentDeckId"],
          message: "Deck parent is invalid",
        });
      }
    });
    manifest.cardTemplates.forEach((template, index) => {
      if (
        template.sourceNoteTypeId &&
        !noteTypeIds.has(template.sourceNoteTypeId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["cardTemplates", index, "sourceNoteTypeId"],
          message: "Card template note type is missing",
        });
      }
    });
    manifest.notes.forEach((note, index) => {
      if (
        !deckIds.has(note.sourceDeckId) ||
        (note.sourceNoteTypeId && !noteTypeIds.has(note.sourceNoteTypeId))
      ) {
        context.addIssue({
          code: "custom",
          path: ["notes", index],
          message: "Note references missing package data",
        });
      }
    });
    manifest.cards.forEach((card, index) => {
      const deck = deckById.get(card.sourceDeckId);
      if (
        !deck ||
        !noteIds.has(card.sourceNoteId) ||
        (card.sourceTemplateId && !templateIds.has(card.sourceTemplateId))
      ) {
        context.addIssue({
          code: "custom",
          path: ["cards", index],
          message: "Card references missing package data",
        });
      }
      if (!isValidCardContentPair(card.kind, card.front, card.back)) {
        context.addIssue({
          code: "custom",
          path: ["cards", index],
          message: "Card content does not match its kind",
        });
      }
      if (deck) {
        for (const locale of Object.keys(card.translations)) {
          if (!deck.contentLocales.includes(locale)) {
            context.addIssue({
              code: "custom",
              path: ["cards", index, "translations", locale],
              message: "Card translation locale is not available in the deck",
            });
          }
        }
      }
    });
  });

export type FlashNFlipManifest = z.infer<typeof flashNFlipManifestSchema>;

const archivedAssetSchema = assetSchema.omit({ data: true }).extend({
  path: z.string().regex(/^media\/[a-f0-9-]{36}$/),
  byteSize: z.number().int().nonnegative().max(maximumExpandedBytes),
});
const archivedManifestSchema = flashNFlipManifestBaseSchema
  .omit({ assets: true })
  .extend({ assets: z.array(archivedAssetSchema).max(10_000) });

type EnvelopeHeader = {
  formatVersion: 2;
  packageId: string;
  cipher: "AES-256-GCM";
  compression: "zip";
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

const envelopeHeaderSchema = z.object({
  formatVersion: z.literal(2),
  packageId: z.uuid(),
  cipher: z.literal("AES-256-GCM"),
  compression: z.literal("zip"),
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
});

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

const signatureInput = (
  magic: Buffer,
  header: EnvelopeHeader,
  ciphertext: Buffer,
): Buffer => Buffer.concat([magic, unsignedHeader(header), ciphertext]);

const createZipArchive = async (
  manifest: FlashNFlipManifest,
): Promise<Buffer> => {
  const zip = new yazl.ZipFile();
  const archivedAssets = manifest.assets.map((asset) => {
    const data = Buffer.from(asset.data, "base64");
    if (sha256(data).toString("hex") !== asset.sha256) {
      throw new Error("Flash-n-Flip package contains invalid media");
    }
    const path = `media/${asset.sourceMediaId}`;
    zip.addBuffer(data, path);
    return {
      sourceMediaId: asset.sourceMediaId,
      mimeType: asset.mimeType,
      sha256: asset.sha256,
      altText: asset.altText,
      path,
      byteSize: data.length,
    };
  });
  const { assets: _assets, ...metadata } = manifest;
  const archiveManifest = archivedManifestSchema.parse({
    ...metadata,
    assets: archivedAssets,
  });
  zip.addBuffer(
    Buffer.from(JSON.stringify(archiveManifest), "utf8"),
    "manifest.json",
  );
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    zip.outputStream.on("data", (chunk: Buffer) =>
      chunks.push(Buffer.from(chunk)),
    );
    zip.outputStream.on("error", reject);
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  zip.end();
  return output;
};

const readZipEntries = async (archive: Buffer): Promise<Map<string, Buffer>> =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      archive,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
      (openError, zip) => {
        if (openError || !zip) {
          reject(
            new Error(
              "Flash-n-Flip package does not contain a valid ZIP archive",
            ),
          );
          return;
        }
        const entries = new Map<string, Buffer>();
        let entryCount = 0;
        let expandedBytes = 0;
        let settled = false;
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          zip.close();
          reject(error);
        };
        zip.on("error", fail);
        zip.on("end", () => {
          if (settled) return;
          settled = true;
          resolve(entries);
        });
        zip.on("entry", (entry) => {
          entryCount += 1;
          const name = entry.fileName.normalize("NFC");
          if (
            entryCount > maximumArchiveEntries ||
            entries.has(name) ||
            (name !== "manifest.json" && !/^media\/[a-f0-9-]{36}$/.test(name))
          ) {
            fail(
              new Error("Flash-n-Flip package contains an unsafe archive path"),
            );
            return;
          }
          expandedBytes += entry.uncompressedSize;
          if (
            expandedBytes > maximumExpandedBytes ||
            (entry.compressedSize > 0 &&
              entry.uncompressedSize > 1024 * 1024 &&
              entry.uncompressedSize / entry.compressedSize > 250)
          ) {
            fail(new Error("Expanded Flash-n-Flip package is too large"));
            return;
          }
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) {
              fail(streamError ?? new Error("Archive entry cannot be read"));
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            stream.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > entry.uncompressedSize) {
                stream.destroy(
                  new Error("Archive entry exceeds its declared size"),
                );
                return;
              }
              chunks.push(Buffer.from(chunk));
            });
            stream.on("error", fail);
            stream.on("end", () => {
              if (settled) return;
              entries.set(name, Buffer.concat(chunks));
              zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });

const readZipArchive = async (archive: Buffer): Promise<FlashNFlipManifest> => {
  const entries = await readZipEntries(archive);
  const manifestBytes = entries.get("manifest.json");
  if (!manifestBytes || manifestBytes.length > 64 * 1024 * 1024) {
    throw new Error("Flash-n-Flip ZIP manifest is missing or too large");
  }
  const archivedManifest = archivedManifestSchema.parse(
    JSON.parse(manifestBytes.toString("utf8")),
  );
  const expectedPaths = new Set([
    "manifest.json",
    ...archivedManifest.assets.map((asset) => asset.path),
  ]);
  if (
    entries.size !== expectedPaths.size ||
    [...entries.keys()].some((path) => !expectedPaths.has(path))
  ) {
    throw new Error("Flash-n-Flip ZIP contains undeclared files");
  }
  const assets = archivedManifest.assets.map((asset) => {
    const data = entries.get(asset.path);
    if (
      !data ||
      data.length !== asset.byteSize ||
      sha256(data).toString("hex") !== asset.sha256
    ) {
      throw new Error("Flash-n-Flip ZIP contains invalid media");
    }
    const { path: _path, byteSize: _byteSize, ...metadata } = asset;
    return { ...metadata, data: data.toString("base64") };
  });
  return flashNFlipManifestSchema.parse({ ...archivedManifest, assets });
};

const encryptPackage = (
  plaintext: Buffer,
  packageId: string,
  userId: string,
  masterSecret: string,
): Buffer => {
  const magic = zipMagic;
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
    keyEncryptionKey(masterSecret, userId, packageId),
    wrapIv,
  );
  const wrappedKey = Buffer.concat([
    wrapCipher.update(contentKey),
    wrapCipher.final(),
  ]);
  const wrapTag = wrapCipher.getAuthTag();
  const { privateKey, publicKey } = signingKeys(masterSecret);
  const header: EnvelopeHeader = {
    formatVersion: 2,
    packageId,
    cipher: "AES-256-GCM",
    compression: "zip",
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
    sign(null, signatureInput(magic, header, ciphertext), privateKey),
  );
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  const headerLength = Buffer.alloc(4);
  headerLength.writeUInt32BE(headerBytes.length);
  return Buffer.concat([magic, headerLength, headerBytes, ciphertext]);
};

export const createFlashNFlipPackage = async (
  manifestInput: FlashNFlipManifest,
  userId: string,
  masterSecret: string,
): Promise<Buffer> => {
  const manifest = flashNFlipManifestSchema.parse(manifestInput);
  return encryptPackage(
    await createZipArchive(manifest),
    manifest.packageId,
    userId,
    masterSecret,
  );
};

export const readFlashNFlipPackage = async (
  input: Buffer,
  userId: string,
  masterSecret: string,
): Promise<FlashNFlipManifest> => {
  const magic = input.subarray(0, 8);
  if (input.length < zipMagic.length + 4 || !magic.equals(zipMagic)) {
    throw new Error("Not a Flash-n-Flip package");
  }
  const headerLength = input.readUInt32BE(8);
  if (headerLength < 100 || headerLength > 32_768) {
    throw new Error("Invalid Flash-n-Flip package header");
  }
  const payloadOffset = 12 + headerLength;
  if (payloadOffset >= input.length) {
    throw new Error("Truncated Flash-n-Flip package");
  }
  const header = envelopeHeaderSchema.parse(
    JSON.parse(input.subarray(12, payloadOffset).toString("utf8")),
  );
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
      signatureInput(magic, header, ciphertext),
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
  const archive = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return readZipArchive(archive);
};
