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
});
