import { describe, expect, it } from "vitest";

import type { DeckDetail } from "@flashcards/api-client";
import type { PeerTransferManifest } from "@flashcards/domain";
import { IncrementalSha256 } from "@flashcards/peer-transfer";

import {
  PeerDeckTransferManager,
  validateDeckTransferManifest,
  validateTransferredMedia,
} from "./peer-deck-transfer";

const senderDeviceId = "019d3000-0000-7000-8000-000000000001";
const deck: DeckDetail = {
  id: "019d3000-0000-7000-8000-000000000002",
  parentDeckId: null,
  title: "Direct transfer",
  description: "",
  language: "en",
  contentLocales: ["en"],
  defaultContentLocale: "en",
  sourceLocale: "en",
  targetLocale: "de",
  studyOrder: "SCHEDULED",
  protectionMode: "STANDARD",
  tags: [],
  favorite: false,
  hiddenAt: null,
  archivedAt: null,
  visual: null,
  sourceTemplateKey: null,
  version: 1,
  updatedAt: "2026-08-06T12:00:00.000Z",
  cards: [
    {
      id: "019d3000-0000-7000-8000-000000000003",
      deckId: "019d3000-0000-7000-8000-000000000002",
      noteId: "019d3000-0000-7000-8000-000000000004",
      front: { blocks: [{ type: "text", text: "Question" }] },
      back: { blocks: [{ type: "text", text: "Answer" }] },
      translations: {},
      kind: "QUESTION",
      position: 0,
      linkedToPrevious: false,
      version: 1,
      suspended: false,
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    },
  ],
};

const deckBytes = new TextEncoder().encode(JSON.stringify([deck]));
const manifest: PeerTransferManifest = {
  version: 1,
  transferId: "019d3000-0000-7000-8000-000000000005",
  kind: "DECK_COPY",
  senderDeviceId,
  rootDeckIds: [deck.id],
  deckCount: 1,
  cardCount: 1,
  noteCount: 1,
  mediaCount: 0,
  totalBytes: deckBytes.byteLength,
  chunkSize: 256 * 1024,
  includesLearningProgress: false,
  manifestPayloadHash: new IncrementalSha256().update(deckBytes).digestHex(),
  media: [],
  createdAt: "2026-08-06T12:00:00.000Z",
};

describe("directly transferred media", () => {
  it("validates MIME against bytes instead of trusting the declaration", async () => {
    const png = new Blob(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      { type: "image/png" },
    );
    await expect(validateTransferredMedia(png, "image/png")).resolves.toBe(
      true,
    );
    await expect(validateTransferredMedia(png, "audio/mpeg")).resolves.toBe(
      false,
    );
  });

  it("accepts only already canonical sanitized SVG bytes", async () => {
    const safe = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L1 1"/></svg>'],
      { type: "image/svg+xml" },
    );
    const active = new Blob(['<svg onload="alert(1)"></svg>'], {
      type: "image/svg+xml",
    });
    await expect(validateTransferredMedia(safe, "image/svg+xml")).resolves.toBe(
      true,
    );
    await expect(
      validateTransferredMedia(active, "image/svg+xml"),
    ).resolves.toBe(false);
  });

  it("accepts only exact, internally consistent deck manifests", () => {
    expect(() =>
      validateDeckTransferManifest(manifest, [deck], senderDeviceId),
    ).not.toThrow();
    expect(() =>
      validateDeckTransferManifest(
        { ...manifest, totalBytes: manifest.totalBytes - 1 },
        [deck],
        senderDeviceId,
      ),
    ).toThrow("does not match");
    expect(() =>
      validateDeckTransferManifest(manifest, [deck], crypto.randomUUID()),
    ).toThrow("does not match");
  });

  it("rejects unreferenced media even when its counts and hashes look valid", () => {
    const withExtraMedia: PeerTransferManifest = {
      ...manifest,
      mediaCount: 1,
      totalBytes: manifest.totalBytes + 4,
      media: [
        {
          id: "019d3000-0000-7000-8000-000000000006",
          mimeType: "image/png",
          byteSize: 4,
          sha256: "a".repeat(64),
          chunkHashes: ["b".repeat(64)],
        },
      ],
    };
    expect(() =>
      validateDeckTransferManifest(withExtraMedia, [deck], senderDeviceId),
    ).toThrow("does not match");
  });

  it("rejects account synchronization frames on a cross-account channel", async () => {
    const errors: string[] = [];
    const manager = new PeerDeckTransferManager(
      {
        onIncoming() {},
        onProgress() {},
        onError(message) {
          errors.push(message);
        },
      },
      false,
    );
    const channel = Object.assign(new EventTarget(), {
      binaryType: "blob",
      bufferedAmountLowThreshold: 0,
      readyState: "open",
      send() {},
    }) as unknown as RTCDataChannel;
    manager.attach(channel, crypto.randomUUID(), senderDeviceId);
    channel.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({ type: "SYNC_HELLO", watermarks: {} }),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors).toEqual([
      "Cross-account sharing cannot synchronize account data",
    ]);
  });
});
