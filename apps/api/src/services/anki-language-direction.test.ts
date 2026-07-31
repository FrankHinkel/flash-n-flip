import { describe, expect, it } from "vitest";

import type { AnkiCardContent, ParsedAnkiPackage } from "./anki-package.js";
import { detectXefjordLanguageDirections } from "./anki-language-direction.js";

const content = (text: string): AnkiCardContent => ({
  blocks: [{ type: "text", text }],
});

const xefjordPackage = (
  cards: ParsedAnkiPackage["decks"][number]["cards"],
  title = "Xefjord's Complete Spanish (Castilian)",
): ParsedAnkiPackage => ({
  collectionTitle: title,
  decks: [
    {
      sourceDeckId: "deck-1",
      title: "Basic Spanish Words and Phrases",
      path: [title, "Basic Spanish Words and Phrases"],
      cards,
    },
  ],
  media: [],
  warnings: [],
  packageVersion: "legacy",
});

describe("Xefjord language direction detection", () => {
  it("detects both directions and removes standalone Castilian markers", () => {
    const detected = detectXefjordLanguageDirections(
      xefjordPackage([
        {
          sourceNoteId: "note-1",
          front: content("Policía\nSpanish (Castilian)"),
          back: content("Police"),
          tags: [],
        },
        {
          sourceNoteId: "note-1",
          front: content("Police\nTo Spanish (Castilian)"),
          back: content("Police\nTo Spanish (Castilian)\n\nPolicía"),
          tags: [],
        },
      ]),
      { sourceLocale: "en", targetLocale: "es" },
    );

    expect(detected.detectedCards).toBe(2);
    expect(detected.removedMarkers).toBe(3);
    expect(detected.directions).toEqual({ "es→en": 1, "en→es": 1 });
    expect(detected.package.decks[0]?.cards).toEqual([
      expect.objectContaining({
        questionLocale: "es",
        answerLocale: "en",
        front: content("Policía"),
      }),
      expect.objectContaining({
        questionLocale: "en",
        answerLocale: "es",
        front: content("Police"),
        back: content("Police\n\nPolicía"),
      }),
    ]);
  });

  it("recognizes another Xefjord language through locale display names", () => {
    const detected = detectXefjordLanguageDirections(
      xefjordPackage(
        [
          {
            sourceNoteId: "note-2",
            front: content("Police\nTo French"),
            back: content("Police\nTo French\n\nPolice"),
            tags: [],
          },
        ],
        "Xefjord’s Complete French",
      ),
      { sourceLocale: "en", targetLocale: "fr" },
    );

    expect(detected.directions).toEqual({ "en→fr": 1 });
    expect(detected.package.decks[0]?.cards[0]).toMatchObject({
      questionLocale: "en",
      answerLocale: "fr",
      front: content("Police"),
    });
  });

  it.each([
    {
      title: "Xefjord's Complete Italian",
      pair: { sourceLocale: "en", targetLocale: "it" },
      front: "Police\nTo Italian",
      direction: "en→it",
    },
    {
      title: "Xefjord's Complete German",
      pair: { sourceLocale: "en", targetLocale: "de" },
      front: "Polizei\nGerman",
      direction: "de→en",
    },
    {
      title: "Xefjord's Complete Portuguese",
      pair: { sourceLocale: "en", targetLocale: "pt" },
      front: "Police\nTo Portuguese",
      direction: "en→pt",
    },
  ])(
    "recognizes the standalone marker pattern in $title",
    ({ title, pair, front, direction }) => {
      const detected = detectXefjordLanguageDirections(
        xefjordPackage(
          [
            {
              sourceNoteId: "note-sample",
              front: content(front),
              back: content("Answer"),
              tags: [],
            },
          ],
          title,
        ),
        pair,
      );

      expect(detected.directions).toEqual({ [direction]: 1 });
      expect(detected.package.decks[0]?.cards[0]?.front).toEqual(
        content(front.split("\n")[0]!),
      );
    },
  );

  it("does not treat inline uses of to as marker lines", () => {
    const parsed = xefjordPackage([
      {
        sourceNoteId: "note-3",
        front: content("Welcome (To-M Sing/To-M Pl)"),
        back: content("Bienvenido"),
        tags: [],
      },
    ]);

    const detected = detectXefjordLanguageDirections(parsed, {
      sourceLocale: "en",
      targetLocale: "es",
    });

    expect(detected.detectedCards).toBe(0);
    expect(detected.package).toBe(parsed);
  });

  it("leaves other Anki packages untouched", () => {
    const parsed = xefjordPackage(
      [
        {
          sourceNoteId: "note-4",
          front: content("Police\nTo French"),
          back: content("Police"),
          tags: [],
        },
      ],
      "My French deck",
    );

    const detected = detectXefjordLanguageDirections(parsed, {
      sourceLocale: "en",
      targetLocale: "fr",
    });

    expect(detected.detectedCards).toBe(0);
    expect(detected.package).toBe(parsed);
  });
});
