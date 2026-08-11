import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseAnkiPackage } from "../../apps/api/src/services/anki-package";
import {
  createAnkiImportPreview,
  prepareAnkiFieldMappedPackage,
  suggestedAnkiFieldMappings,
} from "../../packages/domain/src/anki-import-plan";
import { parseCardImport } from "../../apps/api/src/services/import-export";
import {
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
} from "../../apps/web/lib/local-file-import";
import { parseLocalDelimitedCards } from "../../apps/web/lib/local-text-import";

const fixtureUrl = (name: string) =>
  new URL(`./fixtures/${name}`, import.meta.url);
const expectedUrl = fixtureUrl("general-import-parity.expected.json");

const summarizeBlocks = (content: { blocks: Array<Record<string, unknown>> }) =>
  content.blocks.map((block) => ({
    type:
      block.type === "markdown" || block.type === "richText"
        ? "text"
        : block.type === "importImage"
          ? "image"
          : block.type === "importAudio"
            ? "audio"
            : block.type,
    value:
      block.text ??
      block.source ??
      block.sourceName ??
      block.mediaId ??
      (block.document ? JSON.stringify(block.document) : null),
  }));

const summarizeAnki = async (fileName: string) => {
  const bytes = await readFile(fixtureUrl(fileName));
  const reference = await parseAnkiPackage(bytes, {
    maximumMediaBytes: 16 * 1024 * 1024,
    fileName,
  });
  const referencePreview = createAnkiImportPreview(reference, {
    sha256: "fixture",
    fileName,
    cached: false,
  });
  const preparedReference = prepareAnkiFieldMappedPackage(
    reference,
    suggestedAnkiFieldMappings(referencePreview),
    { sourceLocale: "en", targetLocale: "de" },
  ).package;
  const local = await parseLocalAnkiPackage(
    new File([bytes], fileName) as unknown as globalThis.File,
  );
  return {
    fileName,
    sha256: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
    reference: {
      packageVersion: preparedReference.packageVersion,
      title: preparedReference.collectionTitle,
      paths: preparedReference.decks.map((deck) => deck.path),
      cardCount: preparedReference.decks.reduce(
        (count, deck) => count + deck.cards.length,
        0,
      ),
      media: preparedReference.media.map((item) => ({
        name: item.sourceName,
        type: item.mimeType,
      })),
      cards: preparedReference.decks.flatMap((deck) =>
        deck.cards.map((card) => ({
          front: summarizeBlocks(card.front),
          back: summarizeBlocks(card.back),
          tags: card.tags,
        })),
      ),
    },
    local: {
      title: local.title,
      paths: local.decks.map((deck) => deck.path),
      cardCount: local.decks.reduce(
        (count, deck) => count + deck.cards.length,
        0,
      ),
      media: local.media.map((item) => ({
        name: item.sourceName,
        type: item.mimeType,
      })),
      cards: local.decks.flatMap((deck) =>
        deck.cards.map((card) => ({
          front: summarizeBlocks(card.front),
          back: summarizeBlocks(card.back),
          tags: card.tags,
        })),
      ),
    },
  };
};

const parseLocalText = (input: string) => {
  try {
    return { cards: parseLocalDelimitedCards(input), error: null };
  } catch (cause) {
    return {
      cards: null,
      error: cause instanceof Error ? cause.message : "Unknown error",
    };
  }
};

describe("general import parity", () => {
  it("uses equivalent local and reference import semantics", async () => {
    const anki = await Promise.all(
      [
        "general-classic-subdeck.apkg",
        "general-modern.apkg",
        "general-cloze.apkg",
        "general-image-occlusion.apkg",
      ].map(summarizeAnki),
    );
    const fnfBytes = await readFile(fixtureUrl("general-media.fnf"));
    const fnf = await parseLocalFlashNFlipPackage(
      new File([fnfBytes], "general-media.fnf") as unknown as globalThis.File,
    );
    const csv = await readFile(fixtureUrl("general-csv.csv"), "utf8");
    const tsv = await readFile(fixtureUrl("general-anki.tsv"), "utf8");
    const actual = {
      anki,
      fnf: {
        sha256: createHash("sha256")
          .update(fnfBytes)
          .digest("hex")
          .slice(0, 16),
        title: fnf.title,
        paths: fnf.decks.map((deck) => deck.path),
        cardCount: fnf.decks.reduce(
          (count, deck) => count + deck.cards.length,
          0,
        ),
        media: fnf.media.map((item) => ({
          name: item.sourceName,
          type: item.mimeType,
        })),
      },
      csv: {
        reference: parseCardImport(csv, "CSV"),
        local: parseLocalText(csv),
      },
      tsv: {
        reference: parseCardImport(tsv, "ANKI_TSV"),
        local: parseLocalText(tsv),
      },
    };

    if (process.env.FNF_PRINT_GENERAL_IMPORT_PARITY) {
      process.stdout.write(`${JSON.stringify(actual, null, 2)}\n`);
    }
    const expected = JSON.parse(await readFile(expectedUrl, "utf8")) as {
      anki: Array<{ fileName: string; sha256: string }>;
      fnf: { sha256: string };
    };
    expect(
      actual.anki.map(({ fileName, sha256 }) => ({ fileName, sha256 })),
    ).toEqual(
      expected.anki.map(({ fileName, sha256 }) => ({ fileName, sha256 })),
    );
    for (const item of actual.anki) {
      expect({
        title: item.local.title,
        paths: item.local.paths,
        cardCount: item.local.cardCount,
        cards: item.local.cards,
      }).toEqual({
        title: item.reference.title,
        paths: item.reference.paths,
        cardCount: item.reference.cardCount,
        cards: item.reference.cards,
      });
      expect(item.local.media).toEqual(
        expect.arrayContaining(item.reference.media),
      );
    }
    expect(actual.csv.local).toEqual({
      cards: actual.csv.reference,
      error: null,
    });
    expect(actual.tsv.local).toEqual({
      cards: actual.tsv.reference,
      error: null,
    });
    expect(actual.fnf.sha256).toBe(expected.fnf.sha256);
  });
});
