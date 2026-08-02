import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createId } from "@flashcards/domain";

import {
  createFlashNFlipPackage,
  readFlashNFlipPackage,
  type FlashNFlipManifest,
} from "./fnf-package.js";

const ownerId = createId();
const secret = "test-package-secret-with-at-least-thirty-two-characters";
const content = (text: string) => ({
  blocks: [{ type: "text" as const, text }],
});

const manifest = (): FlashNFlipManifest => {
  const rootDeckId = createId();
  const childDeckId = createId();
  const noteTypeId = createId();
  const templateId = createId();
  const noteId = createId();
  const cardId = createId();
  const mediaId = createId();
  return {
    format: "flash-n-flip.collection",
    formatVersion: 2,
    packageId: createId(),
    exportedAt: new Date().toISOString(),
    rootSourceDeckId: rootDeckId,
    decks: [
      {
        sourceDeckId: rootDeckId,
        sourceParentDeckId: null,
        title: "Protected collection",
        description: "Round-trip test",
        language: "en",
        contentLocales: ["en", "de"],
        defaultContentLocale: "en",
        sourceLocale: "de",
        targetLocale: "en",
        studyOrder: "SEQUENTIAL",
        protectionMode: "ACCOUNT_BOUND",
        tags: ["test"],
        visual: { kind: "IMAGE", value: mediaId },
      },
      {
        sourceDeckId: childDeckId,
        sourceParentDeckId: rootDeckId,
        title: "Child deck",
        description: "",
        language: "en",
        contentLocales: ["en", "de"],
        defaultContentLocale: "en",
        sourceLocale: "de",
        targetLocale: "en",
        studyOrder: "SCHEDULED",
        protectionMode: "ACCOUNT_BOUND",
        tags: [],
        visual: null,
      },
    ],
    noteTypes: [
      {
        sourceNoteTypeId: noteTypeId,
        name: "Imported note type",
        fields: [{ key: "field_0", label: "Einheit" }],
      },
    ],
    cardTemplates: [
      {
        sourceTemplateId: templateId,
        sourceNoteTypeId: noteTypeId,
        name: "Imported template",
        front: { format: "ANKI_SAFE_MAPPING_V1" },
        back: { format: "ANKI_SAFE_MAPPING_V1" },
      },
    ],
    notes: [
      {
        sourceNoteId: noteId,
        sourceDeckId: childDeckId,
        sourceNoteTypeId: noteTypeId,
        fields: { field_0: content("Einheit 1") },
        tags: ["flag:red"],
      },
    ],
    cards: [
      {
        sourceCardId: cardId,
        sourceDeckId: childDeckId,
        sourceNoteId: noteId,
        sourceTemplateId: templateId,
        front: content("Question"),
        back: content("Answer"),
        questionLocale: "en",
        answerLocale: "de",
        translations: {
          en: { front: content("Question"), back: content("Answer") },
          de: { front: content("Frage"), back: content("Antwort") },
        },
        kind: "QUESTION",
        position: 1,
        linkedToPrevious: false,
        suspended: true,
      },
    ],
    assets: [
      {
        sourceMediaId: mediaId,
        mimeType: "image/png",
        sha256: createHash("sha256").update("media").digest("hex"),
        altText: "Test image",
        data: Buffer.from("media").toString("base64"),
      },
    ],
  };
};

describe("protected Flash-n-Flip package", () => {
  it("round-trips a zipped, signed, account-bound collection", async () => {
    const source = manifest();
    const encrypted = await createFlashNFlipPackage(source, ownerId, secret);
    expect(encrypted.subarray(0, 8).toString("ascii")).toBe("FNFPAK02");
    const headerLength = encrypted.readUInt32BE(8);
    expect(
      JSON.parse(encrypted.subarray(12, 12 + headerLength).toString("utf8")),
    ).toMatchObject({ formatVersion: 2, compression: "zip" });
    expect(encrypted.includes(Buffer.from("Question"))).toBe(false);
    expect(await readFlashNFlipPackage(encrypted, ownerId, secret)).toEqual(
      source,
    );
  });

  it("rejects another account and tampered ciphertext", async () => {
    const encrypted = await createFlashNFlipPackage(
      manifest(),
      ownerId,
      secret,
    );
    await expect(
      readFlashNFlipPackage(encrypted, createId(), secret),
    ).rejects.toThrow(/another account/i);
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
    await expect(
      readFlashNFlipPackage(tampered, ownerId, secret),
    ).rejects.toThrow(/corrupted/i);
  });

  it("rejects invalid collection hierarchies and media before encryption", async () => {
    const cyclic = manifest();
    cyclic.decks[0]!.sourceParentDeckId = cyclic.decks[1]!.sourceDeckId;
    await expect(
      createFlashNFlipPackage(cyclic, ownerId, secret),
    ).rejects.toThrow(/root|cycle/i);

    const invalidMedia = manifest();
    invalidMedia.assets[0]!.sha256 = "0".repeat(64);
    await expect(
      createFlashNFlipPackage(invalidMedia, ownerId, secret),
    ).rejects.toThrow(/invalid media/i);
  });

  it("does not accept the retired version-1 envelope", async () => {
    await expect(
      readFlashNFlipPackage(Buffer.from("FNFDECK1 obsolete"), ownerId, secret),
    ).rejects.toThrow(/not a Flash-n-Flip package/i);
  });
});
