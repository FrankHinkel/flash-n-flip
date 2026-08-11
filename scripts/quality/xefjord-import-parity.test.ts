import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
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

type RealPackageBaseline = {
  fileName: string;
  fixtureSha256: string;
  sourceLocale: string;
  targetLocale: string;
  deckCount: number;
  cardCount: number;
  mediaCount: number;
  detectedCards: number;
  removedMarkers: number;
  removedRepeatedQuestions: number;
  directions: Record<string, number>;
  referenceMarkerCards: number;
  localCardCount: number;
  localMediaCount: number;
  localMarkerCards: number;
  remainingMarkerLines: string[];
};

const fixtureUrl = new URL(
  "./fixtures/xefjord-german-parity.apkg",
  import.meta.url,
);
const expectedUrl = new URL(
  "./fixtures/xefjord-german-parity.expected.json",
  import.meta.url,
);
const realBaselinesUrl = new URL(
  "./fixtures/xefjord-real-baselines.expected.json",
  import.meta.url,
);
const normalizedLabel = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const localeLabels = (locale: string): string[] => {
  const language = locale.split("-")[0] ?? locale;
  const labels = new Set<string>();
  const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
  for (const candidate of [locale, language]) {
    const label = displayNames.of(candidate);
    if (label) labels.add(normalizedLabel(label));
  }
  return [...labels];
};

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
  locales: readonly [string, string],
): number =>
  cards.filter((candidate) => {
    const card = candidate as {
      front: { blocks: Array<Record<string, unknown>> };
      back: { blocks: Array<Record<string, unknown>> };
    };
    const labels = new Set(locales.flatMap(localeLabels));
    return `${text(card.front)}\n${text(card.back)}`
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .some((line) => {
        const label = normalizedLabel(line).replace(/^to\s+/, "");
        return labels.has(label);
      });
  }).length;

const remainingMarkerLines = <T>(
  cards: T[],
  text: (content: { blocks: Array<Record<string, unknown>> }) => string,
  locales: readonly [string, string],
): string[] => {
  const labels = new Set(locales.flatMap(localeLabels));
  return [
    ...new Set(
      cards.flatMap((candidate) => {
        const card = candidate as {
          front: { blocks: Array<Record<string, unknown>> };
          back: { blocks: Array<Record<string, unknown>> };
        };
        return `${text(card.front)}\n${text(card.back)}`
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .filter((line) =>
            labels.has(normalizedLabel(line).replace(/^to\s+/, "")),
          );
      }),
    ),
  ];
};

const analyze = async (
  bytes: Buffer,
  fileName: string,
  languagePair?: { sourceLocale: string; targetLocale: string },
) => {
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
  const locales = languagePair ?? {
    sourceLocale: preview.xefjordPreset.suggestedSourceLocale ?? "en",
    targetLocale: preview.xefjordPreset.suggestedTargetLocale ?? "und",
  };
  const reference = prepareAnkiFieldMappedPackage(
    referencePackage,
    xefjordAnkiFieldMappings(preview),
    {
      sourceLocale: locales.sourceLocale,
      targetLocale: locales.targetLocale,
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
    locales,
    referenceMarkerCardCount: markerCardCount(referenceCards, referenceText, [
      locales.sourceLocale,
      locales.targetLocale,
    ]),
    localMarkerCardCount: markerCardCount(localCards, localText, [
      locales.sourceLocale,
      locales.targetLocale,
    ]),
  };
};

const summarize = (
  bytes: Buffer,
  fileName: string,
  result: Awaited<ReturnType<typeof analyze>>,
): RealPackageBaseline => ({
  fileName,
  fixtureSha256: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
  sourceLocale: result.locales.sourceLocale,
  targetLocale: result.locales.targetLocale,
  deckCount: result.referencePackage.decks.length,
  cardCount: result.referenceCards.length,
  mediaCount: result.referencePackage.media.length,
  detectedCards: result.reference.detectedCards,
  removedMarkers: result.reference.removedMarkers,
  removedRepeatedQuestions: result.reference.removedRepeatedQuestions,
  directions: result.reference.directions,
  referenceMarkerCards: result.referenceMarkerCardCount,
  localCardCount: result.localCards.length,
  localMediaCount: result.local.media.length,
  localMarkerCards: result.localMarkerCardCount,
  remainingMarkerLines: remainingMarkerLines(result.localCards, localText, [
    result.locales.sourceLocale,
    result.locales.targetLocale,
  ]),
});

describe("Xefjord pre-PWA parity", () => {
  it("matches the reference semantics without copying a real Xefjord package", async () => {
    const bytes = await readFile(fixtureUrl);
    const result = await analyze(bytes, "xefjord-german-parity.apkg", {
      sourceLocale: "en",
      targetLocale: "de",
    });

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
      result.expected.reference.markerCardCount,
    );
    expect(
      result.localCards.reduce<Record<string, number>>((directions, card) => {
        const questionLocale = card.questionLocale;
        const answerLocale = card.answerLocale;
        if (!questionLocale || !answerLocale) return directions;
        const key = `${questionLocale}→${answerLocale}`;
        directions[key] = (directions[key] ?? 0) + 1;
        return directions;
      }, {}),
    ).toEqual(result.reference.directions);
  });

  it.skipIf(!process.env.FNF_XEFJORD_FIXTURE)(
    "audits a local real package without committing its contents",
    async () => {
      const path = process.env.FNF_XEFJORD_FIXTURE!;
      const bytes = await readFile(path);
      const result = await analyze(bytes, basename(path));
      expect(result.preview.xefjordPreset).toMatchObject({
        detected: true,
      });
      expect(result.preview.xefjordPreset.suggestedTargetLocale).not.toBeNull();

      process.stdout.write(
        `${JSON.stringify(summarize(bytes, basename(path), result))}\n`,
      );

      expect(result.referenceCards.length).toBeGreaterThan(0);
      expect(result.localCards.length).toBeGreaterThan(0);
    },
    20_000,
  );

  it.skipIf(!process.env.FNF_XEFJORD_FIXTURE_DIRECTORY)(
    "matches the structural baselines for the local real language matrix",
    async () => {
      const directory = process.env.FNF_XEFJORD_FIXTURE_DIRECTORY!;
      const baselines = JSON.parse(
        await readFile(realBaselinesUrl, "utf8"),
      ) as RealPackageBaseline[];

      for (const baseline of baselines) {
        const bytes = await readFile(join(directory, baseline.fileName));
        const result = await analyze(bytes, baseline.fileName);
        expect(summarize(bytes, baseline.fileName, result)).toEqual(baseline);
      }
    },
    30_000,
  );
});
