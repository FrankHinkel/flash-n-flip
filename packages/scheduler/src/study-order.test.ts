import { describe, expect, it } from "vitest";

import { buildStudyQueue, type StudyQueueCandidate } from "./study-order.js";

type Candidate = StudyQueueCandidate<{ label?: string }>;

const candidate = (
  id: string,
  noteId: string,
  position: number,
  options: Partial<Candidate> & {
    linkedToPrevious?: boolean;
    queuePriority?: Candidate["queuePriority"];
    dueAt?: number;
  } = {},
): Candidate => ({
  card: {
    id,
    deckId: "deck",
    noteId,
    kind: "QUESTION",
    position,
    linkedToPrevious: options.linkedToPrevious ?? false,
  },
  studyOrder: "SCHEDULED",
  dueAt: options.dueAt ?? 0,
  isDueQuestion: true,
  isProblemCard: options.isProblemCard,
  queuePriority: options.queuePriority ?? "DUE_REVIEW",
});

describe("shared study queue", () => {
  it("buries a second new direction without synthesizing any card", () => {
    const queue = buildStudyQueue(
      [
        candidate("forward", "note", 1, { queuePriority: "NEW" }),
        candidate("reverse", "note", 2, { queuePriority: "NEW" }),
        candidate("math", "math-note", 3, { queuePriority: "NEW" }),
      ],
      { shuffleSeed: "2026-08-16", buryNewSiblings: true },
    );

    expect(queue.filter(({ card }) => card.noteId === "note")).toHaveLength(1);
    expect(queue.map(({ card }) => card.id)).toContain("math");
    expect(queue).toHaveLength(2);
  });

  it("separates due siblings across due buckets without moving either day", () => {
    const queue = buildStudyQueue(
      [
        candidate("forward", "note", 1, { dueAt: 0 }),
        candidate("reverse", "note", 2, { dueAt: 86_400_000 }),
        ...Array.from({ length: 5 }, (_, index) =>
          candidate(`filler-${index}`, `filler-note-${index}`, index + 3, {
            dueAt: 86_400_000,
          }),
        ),
      ],
      { shuffleSeed: "2026-08-16" },
    );
    const ids = queue.map(({ card }) => card.id);

    expect(Math.abs(ids.indexOf("forward") - ids.indexOf("reverse")) - 1).toBe(
      5,
    );
  });

  it("keeps linked cards together even when they share a note", () => {
    const queue = buildStudyQueue(
      [
        candidate("context", "note", 1),
        candidate("follow-up", "note", 2, { linkedToPrevious: true }),
        candidate("other", "other-note", 3),
      ],
      { shuffleSeed: "2026-08-16" },
    );
    const ids = queue.map(({ card }) => card.id);

    expect(ids.indexOf("follow-up")).toBe(ids.indexOf("context") + 1);
  });

  it("mixes a guaranteed new card after the configured review streak", () => {
    const queue = buildStudyQueue(
      [
        ...Array.from({ length: 5 }, (_, index) =>
          candidate(`review-${index}`, `review-note-${index}`, index),
        ),
        ...Array.from({ length: 2 }, (_, index) =>
          candidate(`new-${index}`, `new-note-${index}`, index + 10, {
            queuePriority: "NEW",
          }),
        ),
      ],
      { newReviewOrder: "MIXED", maximumReviewStreak: 2 },
    );

    expect(queue.map(({ card }) => card.id)).toEqual([
      "review-0",
      "review-1",
      "new-0",
      "review-2",
      "review-3",
      "new-1",
      "review-4",
    ]);
  });

  it("can place new cards before due reviews without changing either group", () => {
    const queue = buildStudyQueue(
      [
        candidate("review", "review-note", 1),
        candidate("new", "new-note", 2, { queuePriority: "NEW" }),
      ],
      { newReviewOrder: "NEW_FIRST" },
    );

    expect(queue.map(({ card }) => card.id)).toEqual(["new", "review"]);
  });

  it("caps repeatedly failed cards without hiding ordinary due reviews", () => {
    const queue = buildStudyQueue(
      [
        candidate("problem-1", "problem-note-1", 1, { isProblemCard: true }),
        candidate("regular", "regular-note", 2),
        candidate("problem-2", "problem-note-2", 3, { isProblemCard: true }),
      ],
      { problemCardLimit: 1 },
    );

    expect(queue.map(({ card }) => card.id)).toEqual(["problem-1", "regular"]);
  });
});
