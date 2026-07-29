import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

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

const manifest = (): FlashNFlipManifest => ({
  format: "flash-n-flip.deck",
  formatVersion: 1,
  packageId: createId(),
  exportedAt: new Date().toISOString(),
  deck: {
    title: "Protected deck",
    description: "Round-trip test",
    language: "en",
    contentLocales: ["en", "de"],
    defaultContentLocale: "en",
    studyOrder: "SEQUENTIAL",
    protectionMode: "ACCOUNT_BOUND",
    tags: ["test"],
  },
  cards: [
    {
      sourceCardId: createId(),
      front: content("Question"),
      back: content("Answer"),
      translations: {
        en: { front: content("Question"), back: content("Answer") },
        de: { front: content("Frage"), back: content("Antwort") },
      },
      kind: "QUESTION",
      position: 1,
      linkedToPrevious: false,
      tags: [],
    },
  ],
  assets: [
    {
      sourceMediaId: createId(),
      mimeType: "image/png",
      sha256: createHash("sha256").update("media").digest("hex"),
      altText: "Test image",
      data: Buffer.from("media").toString("base64"),
    },
  ],
});

describe("protected Flash-n-Flip package", () => {
  it("round-trips a signed account-bound package", () => {
    const source = manifest();
    const encrypted = createFlashNFlipPackage(source, ownerId, secret);
    expect(encrypted.subarray(0, 8).toString("ascii")).toBe("FNFDECK1");
    expect(encrypted.includes(Buffer.from("Question"))).toBe(false);
    expect(readFlashNFlipPackage(encrypted, ownerId, secret)).toEqual(source);
  });

  it("rejects another account and tampered ciphertext", () => {
    const encrypted = createFlashNFlipPackage(manifest(), ownerId, secret);
    expect(() => readFlashNFlipPackage(encrypted, createId(), secret)).toThrow(
      /another account/i,
    );
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
    expect(() => readFlashNFlipPackage(tampered, ownerId, secret)).toThrow(
      /corrupted/i,
    );
  });
});
