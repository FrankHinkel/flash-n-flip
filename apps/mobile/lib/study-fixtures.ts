import type { Card, DeckDetail, DueCard } from "@flashcards/api-client";
import type { CardState } from "@flashcards/domain";

const now = "2026-01-01T12:00:00.000Z";

const state = (scheduledDays: number): CardState => ({
  due: now,
  stability: 1,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays,
  reps: 0,
  lapses: 0,
  learningState: "NEW",
  lastReview: null,
});

const preview: DueCard["preview"] = {
  AGAIN: state(0),
  HARD: state(2),
  GOOD: state(6),
  EASY: state(14),
};

const card = (
  id: string,
  deckId: string,
  front: Card["front"],
  back: Card["back"],
): Card => ({
  id,
  deckId,
  noteId: `${id}-note`,
  front,
  back,
  questionLocale: "en",
  answerLocale: "de",
  translations: {},
  kind: "QUESTION",
  version: 1,
  suspended: false,
  createdAt: now,
  updatedAt: now,
});

const deckBase: Omit<
  DeckDetail,
  "id" | "title" | "description" | "visual" | "cards"
> = {
  parentDeckId: null,
  language: "en",
  contentLocales: ["en", "de"],
  defaultContentLocale: "en",
  sourceLocale: "en",
  targetLocale: "de",
  studyOrder: "SCHEDULED",
  protectionMode: "STANDARD",
  tags: ["simulator", "layout"],
  favorite: false,
  hiddenAt: null,
  archivedAt: null,
  sourceTemplateKey: null,
  version: 1,
  updatedAt: now,
};

export type MobileStudyFixture = {
  deck: DeckDetail;
  cards: DueCard[];
};

export function createMobileStudyFixture(
  fixture: "text" | "map",
): MobileStudyFixture {
  const deckId = `fixture-${fixture}`;
  if (fixture === "map") {
    const regionCard = card(
      "fixture-map-france",
      deckId,
      {
        blocks: [
          {
            type: "geographyMap",
            mapId: "europe",
            label: "Find France",
            selectedRegionCode: "FR",
            interactive: false,
            overlays: [],
            targets: [],
          },
        ],
      },
      { blocks: [{ type: "heading", level: 2, text: "France" }] },
    );
    const overview = card(
      "fixture-map-overview",
      deckId,
      {
        blocks: [
          {
            type: "geographyMap",
            mapId: "europe",
            label: "Explore Europe",
            interactive: true,
            overlays: [],
            targets: [{ regionCode: "FR", cardId: regionCard.id }],
          },
        ],
      },
      { blocks: [] },
    );
    return {
      deck: {
        ...deckBase,
        id: deckId,
        title: "Simulator map deck",
        description: "Native map and study layout fixture",
        visual: { kind: "MAP", value: "europe" },
        cards: [overview, regionCard],
      },
      cards: [{ card: regionCard, state: state(0), preview }],
    };
  }

  const textCard = card(
    "fixture-text-card",
    deckId,
    {
      blocks: [
        { type: "heading", level: 2, text: "Responsive study card" },
        {
          type: "text",
          text: "The question remains readable without hiding the answer action.",
        },
      ],
    },
    {
      blocks: [
        { type: "heading", level: 2, text: "Responsive answer" },
        {
          type: "list",
          ordered: false,
          items: [
            "Question and answer scroll inside the card.",
            "The rating controls reserve their own space.",
            "Large text wraps the ratings into two rows.",
          ],
        },
      ],
    },
  );
  return {
    deck: {
      ...deckBase,
      id: deckId,
      title: "Simulator text deck",
      description: "Native text and rating layout fixture",
      visual: null,
      cards: [textCard],
    },
    cards: [{ card: textCard, state: state(0), preview }],
  };
}
