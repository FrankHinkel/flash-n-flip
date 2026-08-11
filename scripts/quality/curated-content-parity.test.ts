import { File } from "node:buffer";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { geographyMaps } from "../../packages/domain/src/geography";
import {
  createNumberCollectionDeckSeeds,
  renderNumberExerciseCard,
} from "../../packages/domain/src/number-collection";
import { createNumberPracticeSequence } from "../../packages/domain/src/numbers";
import {
  markdownToRichTextDocument,
  validateCardContent,
} from "../../packages/domain/src/content";
import { verifyCuratedCatalog } from "../../packages/sync/src/webstack-release";
import { parseLocalFlashNFlipPackage } from "../../apps/web/lib/local-file-import";

const webPublic = (path: string) =>
  new URL(`../../apps/web/public/${path}`, import.meta.url);
const fixture = (path: string) =>
  new URL(`./fixtures/${path}`, import.meta.url);

describe("curated and structured content parity", () => {
  it("verifies the signed geography catalog and its complete map structure", async () => {
    const [catalogBytes, signatureText, keysText] = await Promise.all([
      readFile(webPublic("curated/catalog.v2.json")),
      readFile(webPublic("curated/catalog.v2.signature.json"), "utf8"),
      readFile(webPublic("trusted-webstack-keys.json"), "utf8"),
    ]);
    const catalog = await verifyCuratedCatalog({
      catalogBytes,
      signature: JSON.parse(signatureText),
      trustedKeys: JSON.parse(keysText) as Record<string, string>,
      supportedGenerations: [2],
    });
    const geography = catalog.collections.find(
      (collection) => collection.id === "geography",
    )!;
    const cards = geography.decks.flatMap((deck) => deck.cards);
    const mapBlocks = cards.flatMap((card) =>
      [...card.front.blocks, ...card.back.blocks].filter(
        (block) => block.type === "geographyMap",
      ),
    );
    const mapIds = new Set(mapBlocks.map((block) => block.mapId));

    expect({
      rootKey: geography.rootKey,
      deckCount: geography.decks.length,
      cardCount: cards.length,
      templateCount: catalog.geographyTemplates.length,
      mapBlockCount: mapBlocks.length,
      targetCount: mapBlocks.reduce(
        (count, block) => count + block.targets.length,
        0,
      ),
      mapIdCount: mapIds.size,
      visuals: geography.decks.reduce<Record<string, number>>(
        (counts, deck) => {
          const kind = deck.visual?.kind ?? "NONE";
          counts[kind] = (counts[kind] ?? 0) + 1;
          return counts;
        },
        {},
      ),
    }).toEqual({
      rootKey: "geography:world:v2",
      deckCount: 100,
      cardCount: 2766,
      templateCount: 100,
      mapBlockCount: 2766,
      targetCount: 2666,
      mapIdCount: 100,
      visuals: { GLOBE: 1, MAP: 6, FLAG: 93 },
    });
    expect([...mapIds].every((mapId) => mapId in geographyMaps)).toBe(true);

    const tampered = catalogBytes.slice();
    tampered[tampered.length - 2] ^= 1;
    await expect(
      verifyCuratedCatalog({
        catalogBytes: tampered,
        signature: JSON.parse(signatureText),
        trustedKeys: JSON.parse(keysText) as Record<string, string>,
        supportedGenerations: [2],
      }),
    ).rejects.toThrow(/hash mismatch/i);
  });

  it("characterizes the local Numbers collection through its domain generator", async () => {
    const seeds = await createNumberCollectionDeckSeeds({
      sourceLocale: "de-DE",
      targetLocale: "en-US",
      maximum: 100,
      uiLocale: "de",
    });
    const categories = seeds.slice(2);
    const cards = categories.flatMap((seed) => seed.cards);

    expect(seeds.map((seed) => seed.cards.length)).toEqual([
      0, 0, 5, 4, 4, 5, 1,
    ]);
    expect(cards).toHaveLength(19);
    expect(cards.every((card) => card.questionLocale === "de-DE")).toBe(true);
    expect(cards.every((card) => card.answerLocale === "en-US")).toBe(true);
    const firstRendered = await renderNumberExerciseCard(
      { id: "number-fixture", ...cards[0]! },
      categories[0]!.tags,
      0,
      { maximum: 100, sequenceKey: "de-DE:en-US" },
    );
    expect(firstRendered).toMatchObject({
      front: { blocks: [{ type: "text", text: "(0)" }, { type: "text" }] },
      back: { blocks: [{ type: "text", text: "(0)" }, { type: "text" }] },
    });
    expect(
      cards.every(
        (card) =>
          card.front.blocks[0]?.type === "text" &&
          /^\(.+\)$/u.test(card.front.blocks[0].text),
      ),
    ).toBe(true);
    const round = createNumberPracticeSequence(100, () => 0.5);
    expect(round).toHaveLength(37);
    expect(round.slice(0, 21)).toEqual(
      Array.from({ length: 21 }, (_, value) => value),
    );
    expect(new Set(round)).toHaveLength(round.length);
  });

  it("keeps Markdown, wiki tables, KaTeX, image, and audio structured", async () => {
    const bytes = await readFile(fixture("general-media.fnf"));
    const parsed = await parseLocalFlashNFlipPackage(
      new File([bytes], "general-media.fnf") as unknown as globalThis.File,
    );
    const card = parsed.decks[0]!.cards[0]!;
    const front = validateCardContent(card.front);
    const back = validateCardContent(card.back);
    const markdown = front.blocks.find((block) => block.type === "markdown")!;
    if (markdown.type !== "markdown")
      throw new Error("Markdown fixture missing");
    const document = markdownToRichTextDocument(markdown.source);
    const structure = JSON.stringify(document);

    expect(parsed.media.map((item) => item.kind).sort()).toEqual([
      "audio",
      "image",
    ]);
    expect(front.blocks.map((block) => block.type)).toEqual([
      "markdown",
      "image",
    ]);
    expect(back.blocks.map((block) => block.type)).toEqual([
      "markdown",
      "audio",
    ]);
    expect(markdown.source).toContain("^ Language ^ Value ^");
    expect(structure).toContain('"type":"table"');
    expect(structure).toContain('"type":"mathInline"');
  });
});
