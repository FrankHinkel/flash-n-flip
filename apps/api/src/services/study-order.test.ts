import { describe, expect, it } from "vitest";

import {
  buildStudyQueue,
  limitStudyQueue,
  type StudyQueueCandidate,
} from "./study-order.js";

type TestCard = StudyQueueCandidate<{
  label: string;
}>["card"];

const candidate = (
  card: Partial<TestCard> & Pick<TestCard, "id" | "position" | "label">,
  options: Partial<Omit<StudyQueueCandidate<{ label: string }>, "card">> = {},
): StudyQueueCandidate<{ label: string }> => ({
  card: {
    deckId: "deck-1",
    kind: "QUESTION",
    linkedToPrevious: false,
    ...card,
  },
  studyOrder: "SCHEDULED",
  dueAt: card.position,
  isDueQuestion: true,
  ...options,
});

describe("buildStudyQueue", () => {
  it("places a linked explanation directly before its due question", () => {
    const result = buildStudyQueue([
      candidate(
        {
          id: "explanation",
          position: 1,
          label: "Explanation",
          kind: "EXPLANATION",
        },
        { dueAt: 0, isDueQuestion: false },
      ),
      candidate({
        id: "question",
        position: 2,
        label: "Question",
        linkedToPrevious: true,
      }),
    ]);

    expect(result.map(({ card }) => card.id)).toEqual([
      "explanation",
      "question",
    ]);
  });

  it("does not enqueue an unlinked explanation on its own", () => {
    const result = buildStudyQueue([
      candidate(
        {
          id: "explanation",
          position: 1,
          label: "Explanation",
          kind: "EXPLANATION",
        },
        { isDueQuestion: false },
      ),
      candidate({ id: "question", position: 2, label: "Question" }),
    ]);

    expect(result.map(({ card }) => card.id)).toEqual(["question"]);
  });

  it("preserves card position inside sequential decks", () => {
    const result = buildStudyQueue([
      candidate(
        { id: "second", position: 2, label: "Second" },
        { studyOrder: "SEQUENTIAL", dueAt: 1 },
      ),
      candidate(
        { id: "first", position: 1, label: "First" },
        { studyOrder: "SEQUENTIAL", dueAt: 20 },
      ),
    ]);

    expect(result.map(({ card }) => card.id)).toEqual(["first", "second"]);
  });

  it("keeps linked due questions adjacent in scheduled decks", () => {
    const result = buildStudyQueue([
      candidate({ id: "first", position: 1, label: "First" }, { dueAt: 20 }),
      candidate(
        {
          id: "second",
          position: 2,
          label: "Second",
          linkedToPrevious: true,
        },
        { dueAt: 30 },
      ),
      candidate({ id: "third", position: 3, label: "Third" }, { dueAt: 25 }),
    ]);

    expect(result.map(({ card }) => card.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("does not split a linked group at the queue limit", () => {
    const queue = buildStudyQueue([
      candidate(
        {
          id: "explanation",
          position: 1,
          label: "Explanation",
          kind: "EXPLANATION",
        },
        { isDueQuestion: false },
      ),
      candidate({
        id: "question",
        position: 2,
        label: "Question",
        linkedToPrevious: true,
      }),
      candidate({ id: "later", position: 3, label: "Later" }),
    ]);

    expect(limitStudyQueue(queue, 1).map(({ card }) => card.id)).toEqual([
      "explanation",
      "question",
    ]);
  });

  it("keeps a seeded scheduled queue stable while shuffling authored order", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      candidate(
        {
          id: `card-${index + 1}`,
          position: index + 1,
          label: `Card ${index + 1}`,
        },
        { dueAt: 0, queuePriority: "NEW" },
      ),
    );
    const first = buildStudyQueue(candidates, {
      shuffleSeed: "user:session:day",
    }).map(({ card }) => card.id);
    const repeated = buildStudyQueue([...candidates].reverse(), {
      shuffleSeed: "user:session:day",
    }).map(({ card }) => card.id);

    expect(first).toEqual(repeated);
    expect(first).not.toEqual(candidates.map(({ card }) => card.id));
  });

  it("changes the scheduled order across deterministic session seeds", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      candidate(
        {
          id: `card-${index + 1}`,
          position: index + 1,
          label: `Card ${index + 1}`,
        },
        { dueAt: 0, queuePriority: "NEW" },
      ),
    );
    const orders = new Set(
      ["session-a", "session-b", "session-c"].map((shuffleSeed) =>
        buildStudyQueue(candidates, { shuffleSeed })
          .map(({ card }) => card.id)
          .join(","),
      ),
    );

    expect(orders.size).toBeGreaterThan(1);
  });

  it("interleaves collection decks evenly within a priority tier", () => {
    const candidates = ["deck-a", "deck-b"].flatMap((deckId) =>
      Array.from({ length: 3 }, (_, index) =>
        candidate(
          {
            id: `${deckId}-${index + 1}`,
            deckId,
            position: index + 1,
            label: `${deckId} ${index + 1}`,
          },
          { dueAt: 0, queuePriority: "NEW" },
        ),
      ),
    );
    const result = buildStudyQueue(candidates, {
      shuffleSeed: "collection-session",
    });

    for (let index = 0; index < result.length; index += 2) {
      expect(
        new Set(result.slice(index, index + 2).map(({ card }) => card.deckId)),
      ).toEqual(new Set(["deck-a", "deck-b"]));
    }
  });

  it("keeps each sequential child deck internally ordered", () => {
    const result = buildStudyQueue(
      [
        candidate(
          {
            id: "sequential-3",
            deckId: "sequential",
            position: 3,
            label: "Third",
          },
          { studyOrder: "SEQUENTIAL", queuePriority: "NEW" },
        ),
        candidate(
          {
            id: "scheduled",
            deckId: "scheduled",
            position: 1,
            label: "Scheduled",
          },
          { queuePriority: "NEW" },
        ),
        candidate(
          {
            id: "sequential-1",
            deckId: "sequential",
            position: 1,
            label: "First",
          },
          { studyOrder: "SEQUENTIAL", queuePriority: "NEW" },
        ),
        candidate(
          {
            id: "sequential-2",
            deckId: "sequential",
            position: 2,
            label: "Second",
          },
          { studyOrder: "SEQUENTIAL", queuePriority: "NEW" },
        ),
      ],
      { shuffleSeed: "collection-session" },
    );

    expect(
      result
        .filter(({ card }) => card.deckId === "sequential")
        .map(({ card }) => card.position),
    ).toEqual([1, 2, 3]);
  });

  it("runs a directly selected sequential deck without interruption", () => {
    const result = buildStudyQueue(
      [
        candidate(
          {
            id: "selected-2",
            deckId: "selected",
            position: 2,
            label: "Second",
          },
          { studyOrder: "SEQUENTIAL", queuePriority: "NEW" },
        ),
        candidate(
          {
            id: "other",
            deckId: "child",
            position: 1,
            label: "Other",
          },
          { queuePriority: "NEW" },
        ),
        candidate(
          {
            id: "selected-1",
            deckId: "selected",
            position: 1,
            label: "First",
          },
          { studyOrder: "SEQUENTIAL", queuePriority: "NEW" },
        ),
      ],
      {
        shuffleSeed: "selected-session",
        selectedDeckId: "selected",
      },
    );

    expect(result.map(({ card }) => card.id)).toEqual([
      "selected-1",
      "selected-2",
      "other",
    ]);
  });

  it("keeps due reviews ahead of new and future practice cards", () => {
    const result = buildStudyQueue(
      [
        candidate(
          { id: "new", position: 1, label: "New" },
          { dueAt: 0, queuePriority: "NEW" },
        ),
        candidate(
          { id: "practice", position: 2, label: "Practice" },
          { dueAt: 30, queuePriority: "PRACTICE" },
        ),
        candidate(
          { id: "review", position: 3, label: "Review" },
          { dueAt: 20, queuePriority: "DUE_REVIEW" },
        ),
      ],
      { shuffleSeed: "priority-session" },
    );

    expect(result.map(({ card }) => card.id)).toEqual([
      "review",
      "new",
      "practice",
    ]);
  });
});
