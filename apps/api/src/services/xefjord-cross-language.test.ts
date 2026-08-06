import { describe, expect, it } from "vitest";

import {
  createXefjordCrossLanguageCards,
  isSupportedXefjordPhraseSchema,
  normalizeXefjordPivot,
  xefjordPivotMatchKey,
  xefjordVirtualCardId,
  type XefjordCrossLanguagePair,
} from "./xefjord-cross-language.js";

const textContent = (text: string) => ({
  blocks: [{ type: "text" as const, text }],
});

const entry = (phrase: string, pivot: string, audioName: string) => ({
  noteId: "10000000-0000-4000-8000-000000000001",
  pivot,
  phrase: {
    blocks: [
      { type: "text" as const, text: phrase },
      {
        type: "audio" as const,
        mediaId: `${audioName}-inline-media`,
        label: "",
      },
    ],
  },
  image: {
    blocks: [
      {
        type: "image" as const,
        mediaId: `${audioName}-image-media`,
        alt: "",
        decorative: true,
      },
    ],
  },
  audio: {
    blocks: [
      {
        type: "audio" as const,
        mediaId: `${audioName}-audio-media`,
        label: "",
      },
    ],
  },
  version: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("Xefjord cross-language linking", () => {
  it("normalizes only the internal English pivot deterministically", () => {
    expect(normalizeXefjordPivot("  Good\u00a0  NIGHT  ")).toBe("good night");
    expect(xefjordPivotMatchKey("Good night")).toBe(
      xefjordPivotMatchKey(" good  NIGHT "),
    );
    expect(xefjordPivotMatchKey("Good night")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts Phrase schemas and excludes sentence collections", () => {
    expect(
      isSupportedXefjordPhraseSchema([
        { key: "phrase", label: "Phrase" },
        { key: "translation", label: "Phrase Translation" },
        { key: "audio", label: "Audio" },
      ]),
    ).toBe(true);
    expect(
      isSupportedXefjordPhraseSchema([
        { key: "phrase", label: "Phrase" },
        { key: "translation", label: "Phrase Translation" },
        { key: "sentence", label: "Sentence" },
      ]),
    ).toBe(false);
  });

  it("uses stable direction-specific identities and answer-language audio", () => {
    const matchKey = xefjordPivotMatchKey("night");
    const pair: XefjordCrossLanguagePair = {
      collectionDeckId: "00000000-0000-4000-8000-000000000001",
      source: {
        id: "00000000-0000-4000-8000-000000000002",
        collectionDeckId: "00000000-0000-4000-8000-000000000001",
        title: "Deutsch",
        locale: "de",
      },
      target: {
        id: "00000000-0000-4000-8000-000000000003",
        collectionDeckId: "00000000-0000-4000-8000-000000000001",
        title: "Icelandic",
        locale: "is",
      },
      matches: [
        {
          matchKey,
          source: entry("Nacht", "night", "de"),
          target: {
            ...entry("Nótt", "night", "is"),
            noteId: "10000000-0000-4000-8000-000000000002",
          },
        },
      ],
    };

    const [deToIs] = createXefjordCrossLanguageCards(pair, "SOURCE_TO_TARGET");
    const [isToDe] = createXefjordCrossLanguageCards(pair, "TARGET_TO_SOURCE");
    expect(deToIs?.card.id).toBe(
      xefjordVirtualCardId(pair.source.id, pair.target.id, matchKey),
    );
    expect(isToDe?.card.id).not.toBe(deToIs?.card.id);
    expect(deToIs?.card.front).toEqual(textContent("Nacht"));
    expect(deToIs?.card.back.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Nótt" }),
        expect.objectContaining({ type: "audio", mediaId: "is-audio-media" }),
      ]),
    );
    expect(JSON.stringify(deToIs?.card.front)).not.toContain("de-inline-media");
    expect(JSON.stringify(deToIs?.card.back)).not.toContain("de-audio-media");
    expect(createXefjordCrossLanguageCards(pair, "MIXED")).toHaveLength(2);
  });
});
