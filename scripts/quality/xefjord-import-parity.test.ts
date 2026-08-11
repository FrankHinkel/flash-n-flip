import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseAnkiPackage } from "../../apps/api/src/services/anki-package";
import {
  createAnkiImportPreview,
  prepareAnkiFieldMappedPackage,
  xefjordAnkiFieldMappings,
} from "../../apps/api/src/services/anki-import-plan";
import { parseLocalAnkiPackage } from "../../apps/web/lib/local-file-import";

type ExpectedParity = {
  collectionTitle: string;
  deckPath: string[];
  cardCount: number;
  mediaCount: number;
  sourceLocale: string;
  targetLocale: string;
  reference: {
    detectedCards: number;
    markerCardCount: number;
    directions: Record<string, number>;
  };
  recoveryStart: { markerCardCount: number };
};

const fixtureUrl = new URL(
  "./fixtures/xefjord-german-parity.apkg",
  import.meta.url,
);
const expectedUrl = new URL(
  "./fixtures/xefjord-german-parity.expected.json",
  import.meta.url,
);
const markerPattern = /(?:^|\s)(?:to\s+)?german(?:\s|$)/i;

const referenceText = (content: {
  blocks: Array<Record<string, unknown>>;
}): string =>
  content.blocks
    .flatMap((block) => {
      if (typeof block.text === "string") return [block.text];
      if (block.type === "richText") return [JSON.stringify(block.document)];
      return [];
    })
    .join("\n");

const localText = (content: {
  blocks: Array<Record<string, unknown>>;
}): string =>
  content.blocks
    .flatMap((block) => {
      if (typeof block.source === "string") return [block.source];
      if (typeof block.text === "string") return [block.text];
      return [];
    })
    .join("\n");

const markerCardCount = <T>(
  cards: T[],
  text: (content: { blocks: Array<Record<string, unknown>> }) => string,
): number =>
  cards.filter((candidate) => {
    const card = candidate as {
      front: { blocks: Array<Record<string, unknown>> };
      back: { blocks: Array<Record<string, unknown>> };
    };
    return markerPattern.test(`${text(card.front)}\n${text(card.back)}`);
  }).length;

const analyze = async (bytes: Buffer, fileName: string) => {
  const expected = JSON.parse(
    await readFile(expectedUrl, "utf8"),
  ) as ExpectedParity;
  const referencePackage = await parseAnkiPackage(bytes, {
    maximumMediaBytes: 16 * 1024 * 1024,
    fileName,
  });
  const preview = createAnkiImportPreview(referencePackage, {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fileName,
    cached: false,
  });
  const reference = prepareAnkiFieldMappedPackage(
    referencePackage,
    xefjordAnkiFieldMappings(preview),
    {
      sourceLocale: expected.sourceLocale,
      targetLocale: expected.targetLocale,
    },
  );
  const local = await parseLocalAnkiPackage(
    new File([bytes], fileName) as unknown as globalThis.File,
  );
  const referenceCards = reference.package.decks.flatMap((deck) => deck.cards);
  const localCards = local.decks.flatMap((deck) => deck.cards);
  return {
    expected,
    preview,
    reference,
    referencePackage: reference.package,
    local,
    referenceCards,
    localCards,
    referenceMarkerCardCount: markerCardCount(referenceCards, referenceText),
    localMarkerCardCount: markerCardCount(localCards, localText),
  };
};

describe("Xefjord German pre-PWA parity", () => {
  it("records the semantic gap without copying a real Xefjord package", async () => {
    const bytes = await readFile(fixtureUrl);
    const result = await analyze(bytes, "xefjord-german-parity.apkg");

    expect(result.preview.xefjordPreset).toMatchObject({
      detected: true,
      directImportAvailable: true,
      suggestedSourceLocale: result.expected.sourceLocale,
      suggestedTargetLocale: result.expected.targetLocale,
    });
    expect(result.referencePackage.collectionTitle).toBe(
      result.expected.collectionTitle,
    );
    expect(result.referencePackage.decks[0]?.path).toEqual(
      result.expected.deckPath,
    );
    expect(result.referenceCards).toHaveLength(result.expected.cardCount);
    expect(result.referencePackage.media).toHaveLength(
      result.expected.mediaCount,
    );
    expect(result.reference.detectedCards).toBe(
      result.expected.reference.detectedCards,
    );
    expect(result.reference.directions).toEqual(
      result.expected.reference.directions,
    );
    expect(result.referenceMarkerCardCount).toBe(
      result.expected.reference.markerCardCount,
    );

    expect(result.localCards).toHaveLength(result.expected.cardCount);
    expect(result.local.media).toHaveLength(result.expected.mediaCount);
    expect(result.localMarkerCardCount).toBe(
      result.expected.recoveryStart.markerCardCount,
    );
    expect(result.localMarkerCardCount).toBeGreaterThan(
      result.referenceMarkerCardCount,
    );
  });

  it.skipIf(!process.env.FNF_XEFJORD_FIXTURE)(
    "audits the local real German package without committing its contents",
    async () => {
      const path = process.env.FNF_XEFJORD_FIXTURE!;
      const bytes = await readFile(path);
      const result = await analyze(bytes, basename(path));
      expect(result.preview.xefjordPreset).toMatchObject({
        detected: true,
        suggestedTargetLocale: "de",
      });
      expect(result.reference.detectedCards).toBeGreaterThan(0);
      expect(result.reference.removedMarkers).toBeGreaterThan(0);
      expect(result.localMarkerCardCount).toBeGreaterThan(
        result.referenceMarkerCardCount,
      );

      process.stdout.write(
        `${JSON.stringify({
          fixtureSha256: createHash("sha256")
            .update(bytes)
            .digest("hex")
            .slice(0, 16),
          deckCount: result.referencePackage.decks.length,
          cardCount: result.referenceCards.length,
          mediaCount: result.referencePackage.media.length,
          detectedCards: result.reference.detectedCards,
          removedMarkers: result.reference.removedMarkers,
          referenceMarkerCards: result.referenceMarkerCardCount,
          localMarkerCards: result.localMarkerCardCount,
        })}\n`,
      );
    },
  );
});
